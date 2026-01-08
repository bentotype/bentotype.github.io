
import Foundation
import UIKit

class GeminiScannerService {
    static let shared = GeminiScannerService()
    
    // REPLACE WITH YOUR ACTUAL API KEY
    private let apiKey = "AIzaSyAIDs3SpJJZsHy6_BI6BTXn-XMJbmRNsPo"
    
    // Using gemini-3-flash-preview (Available on your key).
    // Alternates: "gemini-2.5-flash", "gemini-2.0-flash"
    private let modelName = "gemini-3-flash-preview"
    
    func scanReceipt(image: UIImage, completion: @escaping (Result<[ScannedItem], Error>) -> Void) {
        // 1. Prepare Image (Optimized for Tokens)
        // Redux to 512x512 - usually sufficient for receipts and saves tokens/bandwidth
        guard let resizedImage = resizeImage(image: image, targetSize: CGSize(width: 512, height: 512)),
              let imageData = resizedImage.jpegData(compressionQuality: 0.5) else {
            completion(.failure(NSError(domain: "Gemini", code: -1, userInfo: [NSLocalizedDescriptionKey: "Image processing failed"])))
            return
        }
        
        let base64Image = imageData.base64EncodedString()
        
        // 2. Prepare URL
        let urlString = "https://generativelanguage.googleapis.com/v1beta/models/\(modelName):generateContent?key=\(apiKey)"
        guard let url = URL(string: urlString) else { return }
        
        // 3. Prepare Payload
        // Minimal prompt + instruction for short names to save output tokens
        let promptText = "Items,tax,total.Short names."
        
        // Construct JSON Schema (Optimized: short keys to save output tokens)
        // i = items, n = name, p = price
        let jsonSchema: [String: Any] = [
            "type": "OBJECT",
            "properties": [
                "i": [
                    "type": "ARRAY",
                    "items": [
                        "type": "OBJECT",
                        "properties": [
                            "n": ["type": "STRING"],
                            "p": ["type": "NUMBER"]
                        ],
                        "required": ["n", "p"]
                    ]
                ]
            ],
            "required": ["i"]
        ]
        
        let parameters: [String: Any] = [
            "contents": [
                [
                    "parts": [
                        ["text": promptText],
                        [
                            "inline_data": [
                                "mime_type": "image/jpeg",
                                "data": base64Image
                            ]
                        ]
                    ]
                ]
            ],
            "generationConfig": [
                "response_mime_type": "application/json",
                "response_schema": jsonSchema,
                "maxOutputTokens": 1000
            ]
        ]
        
        guard let httpBody = try? JSONSerialization.data(withJSONObject: parameters) else { return }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = httpBody
        
        // 4. Send Request
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            guard let data = data else {
                completion(.failure(NSError(domain: "Gemini", code: -2, userInfo: [NSLocalizedDescriptionKey: "No data received"])))
                return
            }
            
            // Check for API Error structure first
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let errorObj = json["error"] as? [String: Any],
               let message = errorObj["message"] as? String {
                let code = errorObj["code"] as? Int ?? -3
                completion(.failure(NSError(domain: "GeminiAPI", code: code, userInfo: [NSLocalizedDescriptionKey: message])))
                return
            }
            
            // 5. Decode Response
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let candidates = json["candidates"] as? [[String: Any]],
                   let candidate = candidates.first {
                    
                    // Check if response was truncated due to token limit
                    if let finishReason = candidate["finishReason"] as? String,
                       finishReason == "MAX_TOKENS" {
                        let truncationError = NSError(
                            domain: "Gemini",
                            code: -5,
                            userInfo: [NSLocalizedDescriptionKey: "Receipt too long. Please bring your camera closer to capture only the items and total price."]
                        )
                        completion(.failure(truncationError))
                        return
                    }
                    
                    if let content = candidate["content"] as? [String: Any],
                       let parts = content["parts"] as? [[String: Any]],
                       let text = parts.first?["text"] as? String {
                        
                        if let rawData = text.data(using: .utf8),
                           let parsedRoot = try? JSONDecoder().decode(GeminiResponseRoot.self, from: rawData) {
                            
                            let mappedItems = parsedRoot.i.map { ScannedItem(name: $0.n, price: $0.p) }
                            completion(.success(mappedItems))
                            return
                        }
                    }
                }
                print("Failed parsing. JSON: \(String(data: data, encoding: .utf8) ?? "nil")")
                completion(.failure(NSError(domain: "Gemini", code: -4, userInfo: [NSLocalizedDescriptionKey: "Invalid JSON structure"])))
            } catch {
                completion(.failure(error))
            }
        }.resume()
    }
    
    private func resizeImage(image: UIImage, targetSize: CGSize) -> UIImage? {
        let size = image.size
        let widthRatio  = targetSize.width  / size.width
        let heightRatio = targetSize.height / size.height
        let newSize: CGSize
        if(widthRatio > heightRatio) {
            newSize = CGSize(width: size.width * heightRatio, height: size.height * heightRatio)
        } else {
            newSize = CGSize(width: size.width * widthRatio,  height: size.height * widthRatio)
        }
        let rect = CGRect(x: 0, y: 0, width: newSize.width, height: newSize.height)
        
        UIGraphicsBeginImageContextWithOptions(newSize, false, 1.0)
        image.draw(in: rect)
        let newImage = UIGraphicsGetImageFromCurrentImageContext()
        UIGraphicsEndImageContext()
        return newImage
    }
}

// Internal Response Models (short keys to match schema)
// nonisolated to allow decoding on background threads (Swift 6 fix)
private nonisolated struct GeminiResponseRoot: Codable, Sendable {
    let i: [GeminiItem]  // items
}

private nonisolated struct GeminiItem: Codable, Sendable {
    let n: String   // name
    let p: Double   // price
}

//
//  ImageCacheService.swift
//  Split
//
//  Created by Benjamin Chen on 12/23/25.
//

import SwiftUI
import Combine

class ImageCacheService: ObservableObject {
    static let shared = ImageCacheService()
    
    private var cache = NSCache<NSString, UIImage>()
    private var urlCache = NSCache<NSString, NSString>() // Maps user ID string to signed URL string
    
    // Store active tasks to prevent duplicate fetches
    private var activeTasks: [String: Task<Void, Never>] = [:]
    
    private let fileManager = FileManager.default
    private var cacheDirectory: URL {
        fileManager.urls(for: .cachesDirectory, in: .userDomainMask)[0]
    }
    
    private init() {
        cache.countLimit = 100 // Cache up to 100 profile images
        
        // Ensure cache directory exists
        // (Optional, usually Caches dir exists, but good practice if creating subfolder)
    }
    
    func getImage(for key: String) async -> UIImage? {
        // 1. Check Memory (NSCache is thread-safe)
        if let image = cache.object(forKey: key as NSString) {
            return image
        }
        
        // 2. Check Disk (Detached Task to avoid blocking caller)
        let fileURL = cacheDirectory.appendingPathComponent(key)
        return await Task.detached(priority: .userInitiated) {
            if let data = try? Data(contentsOf: fileURL), let image = UIImage(data: data) {
                // Restore to memory for faster access next time
                self.cache.setObject(image, forKey: key as NSString)
                return image
            }
            return nil
        }.value
    }
    
    func saveImage(_ image: UIImage, for key: String) {
        // 1. Save to Memory
        cache.setObject(image, forKey: key as NSString)
        
        // 2. Save to Disk (Background)
        Task(priority: .background) {
            let fileURL = cacheDirectory.appendingPathComponent(key)
            if let data = image.jpegData(compressionQuality: 0.8) {
                try? data.write(to: fileURL)
            }
        }
    }
    
    // Returns cached signed URL if valid
    func getCachedSignedURL(for key: String) -> URL? {
        if let urlString = urlCache.object(forKey: key as NSString) as String? {
            return URL(string: urlString)
        }
        return nil
    }
    
    func cacheSignedURL(_ url: URL, for key: String) {
        urlCache.setObject(url.absoluteString as NSString, forKey: key as NSString)
    }
}

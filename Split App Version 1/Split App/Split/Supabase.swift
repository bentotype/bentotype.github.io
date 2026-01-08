//
//  Supabase.swift
//  Split
//
//  Created by Benjamin Chen on 10/25/25.
//


import Supabase
import Foundation

class SupabaseManager {
    static let shared = SupabaseManager()

    let client: SupabaseClient

    // !! IMPORTANT !!
    // Replace with your actual Supabase URL and Anon Key
    private let supabaseURL = URL(string: "https://kircuqgxdrqfnnjpvoji.supabase.co")!
    private let supabaseKey = "sb_publishable_AODwY5l6R3O0CKYRVff92w_tJKpevIW"

    private init() {
        client = SupabaseClient(supabaseURL: supabaseURL, supabaseKey: supabaseKey)
    }
    
    /// Pre-warm the connection pool by making a lightweight request.
    /// Call this during app startup to avoid "first access" freeze.
    func prewarm() {
        Task.detached(priority: .background) {
            // Simple health check that warms up TLS/DNS without blocking UI
            _ = try? await self.client.from("user_info").select("user_id", head: true).limit(1).execute()
            print("Supabase connection pre-warmed")
        }
    }
}

extension JSONDecoder {
    // Static formatters to avoid repeated allocation
    private static let iso8601Formatter = ISO8601DateFormatter()
    private static let iso8601FractionalFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let dateOnlyFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.calendar = Calendar(identifier: .iso8601)
        f.timeZone = TimeZone(secondsFromGMT: 0)
        return f
    }()
    
    static var supabase: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let string = try container.decode(String.self)
            
            // Try ISO8601 (Full)
            if let date = iso8601Formatter.date(from: string) {
                return date
            }
            
            // Try YYYY-MM-DD
            if let date = dateOnlyFormatter.date(from: string) {
                return date
            }
            
            // Try ISO8601 with fractional seconds
            if let date = iso8601FractionalFormatter.date(from: string) {
                return date
            }
            
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid date format: \(string)")
        }
        return decoder
    }
}

// Convenience extension for Auth and Storage
extension SupabaseManager {
    // Convenience getter for the Auth client
    var auth: AuthClient {
        client.auth
    }
    
    func getStorageUrl(path: String) -> String {
        return "\(supabaseURL)/storage/v1/object/public/\(path)"
    }
}

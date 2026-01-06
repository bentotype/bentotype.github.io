//
//  DebugLogger.swift
//  Split
//
//  Centralized debug logging service with Supabase upload capability
//

import Foundation
import Combine
import Supabase
import Auth

struct DebugLogEntry: Codable {
    let id: UUID
    let logs: String
}

@MainActor
class DebugLogger: ObservableObject {
    static let shared = DebugLogger()
    
    private let maxLocalLogs = 500
    private let storageKey = "debug_logs"
    
    @Published var logs: [String] = []
    @Published var isUploading = false
    @Published var lastUploadResult: String?
    
    private init() {
        loadLogsFromDisk()
    }
    
    // MARK: - Logging
    
    func log(_ message: String, file: String = #file, function: String = #function, line: Int = #line) {
        let fileName = (file as NSString).lastPathComponent
        let timestamp = ISO8601DateFormatter().string(from: Date())
        let entry = "[\(timestamp)] [\(fileName):\(line)] \(function) - \(message)"
        
        logs.append(entry)
        
        // Trim if too many
        if logs.count > maxLocalLogs {
            logs.removeFirst(logs.count - maxLocalLogs)
        }
        
        saveLogsToDisk()
        
        // Also print to console for Xcode debugging
        print(entry)
    }
    
    func logError(_ error: Error, file: String = #file, function: String = #function, line: Int = #line) {
        log("ERROR: \(error.localizedDescription)", file: file, function: function, line: line)
    }
    
    // MARK: - Persistence
    
    private func saveLogsToDisk() {
        UserDefaults.standard.set(logs, forKey: storageKey)
    }
    
    private func loadLogsFromDisk() {
        if let stored = UserDefaults.standard.array(forKey: storageKey) as? [String] {
            logs = stored
        }
    }
    
    func clearLogs() {
        logs.removeAll()
        UserDefaults.standard.removeObject(forKey: storageKey)
        lastUploadResult = nil
    }
    
    // MARK: - Upload to Supabase
    
    func uploadLogs() async {
        guard let userId = SupabaseManager.shared.auth.currentSession?.user.id else {
            lastUploadResult = "Not logged in"
            return
        }
        
        guard !logs.isEmpty else {
            lastUploadResult = "No logs to upload"
            return
        }
        
        isUploading = true
        lastUploadResult = nil
        
        let combinedLogs = logs.joined(separator: "\n")
        let entry = DebugLogEntry(id: userId, logs: combinedLogs)
        
        do {
            try await SupabaseManager.shared.client
                .from("debugging")
                .insert(entry)
                .execute()
            
            lastUploadResult = "Uploaded \(logs.count) logs successfully"
            clearLogs()
        } catch {
            lastUploadResult = "Upload failed: \(error.localizedDescription)"
            log("Failed to upload logs: \(error)")
        }
        
        isUploading = false
    }
}

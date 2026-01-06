//
//  DebuggingView.swift
//  Split
//
//  Settings view for viewing and uploading debug logs
//

import SwiftUI

struct DebuggingView: View {
    @StateObject private var logger = DebugLogger.shared
    @State private var showingClearConfirm = false
    
    var body: some View {
        Form {
            Section {
                HStack {
                    Text("Logs Collected")
                    Spacer()
                    Text("\(logger.logs.count)")
                        .foregroundColor(.secondary)
                }
                
                Button {
                    Task { await logger.uploadLogs() }
                } label: {
                    HStack {
                        Text("Upload Logs to Support")
                        Spacer()
                        if logger.isUploading {
                            ProgressView()
                        }
                    }
                }
                .disabled(logger.logs.isEmpty || logger.isUploading)
                
                if let result = logger.lastUploadResult {
                    Text(result)
                        .font(.caption)
                        .foregroundColor(result.contains("success") ? .green : .red)
                }
            } header: {
                Text("Debug Logs")
            } footer: {
                Text("Logs are stored locally and can be uploaded to help diagnose issues.")
            }
            
            Section {
                Button("Clear All Logs", role: .destructive) {
                    showingClearConfirm = true
                }
                .disabled(logger.logs.isEmpty)
            }
            
            Section {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 4) {
                        ForEach(logger.logs.reversed(), id: \.self) { log in
                            Text(log)
                                .font(.system(size: 10, design: .monospaced))
                                .foregroundColor(.secondary)
                        }
                    }
                }
                .frame(maxHeight: 300)
            } header: {
                Text("Recent Logs")
            }
        }
        .navigationTitle("Debugging")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Clear Logs?", isPresented: $showingClearConfirm) {
            Button("Cancel", role: .cancel) {}
            Button("Clear", role: .destructive) {
                logger.clearLogs()
            }
        } message: {
            Text("This will delete all locally stored debug logs.")
        }
    }
}

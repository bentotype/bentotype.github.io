//
//  ContentView.swift
//  Split
//
//  Created by Benjamin Chen on 10/25/25.
//

import SwiftUI
import Auth

struct ContentView: View {
    @StateObject private var authViewModel = AuthViewModel()
    @StateObject private var notificationManager = NotificationManager.shared
    @StateObject private var appDataManager = AppDataManager.shared

    var body: some View {
        SwiftUI.Group {
            if authViewModel.isCheckingSession {
                // Splash / Launch Screen - shown only during initial session check
                VStack(spacing: 16) {
                    Image(systemName: "arrow.triangle.2.circlepath")
                        .font(.system(size: 80))
                        .foregroundColor(.indigo)
                    Text("Split")
                        .font(.system(size: 48, weight: .bold))
                        .foregroundColor(.indigo)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color.white) // Ensure it's not transparent/black
                .ignoresSafeArea()
                .onAppear {
                    // Pre-warm Supabase connection
                    SupabaseManager.shared.prewarm()
                }
            } else if authViewModel.session != nil {
                // User is logged in - show main tab view
                MainTabView()
                    .task {
                        // Brief delay to let the view settle before triggering @Published changes
                        try? await Task.sleep(nanoseconds: 100_000_000) // 100ms
                        
                        // Preload data in background (non-blocking)
                        if !appDataManager.preloadComplete {
                            await appDataManager.preloadAllData()
                        }
                        notificationManager.requestPermission()
                        if let session = authViewModel.session {
                            await notificationManager.setupListeners(userId: session.user.id)
                        }
                    }
            } else {
                // User is logged out - show welcome screen
                WelcomeView()
            }
        }
        // Pass managers to all child views
        .environmentObject(authViewModel)
        .environmentObject(notificationManager)
        .environmentObject(appDataManager)
        .onChange(of: authViewModel.session) { _, newSession in
            if newSession == nil {
                // User logged out - clear cached data
                appDataManager.clearCache()
            } else if !appDataManager.preloadComplete {
                // User just logged in - trigger preload
                Task { await appDataManager.preloadAllData() }
            }
        }
    }
}

#Preview {
    ContentView()
}

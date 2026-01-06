//
//  PreferencesView.swift
//  Split
//
//  Sub-view for app preferences
//

import SwiftUI

struct PreferencesView: View {
    @ObservedObject var viewModel: ProfileViewModel
    
    var body: some View {
        Form {
            Section {
                Button("Test Notification (5s)") {
                    NotificationManager.shared.scheduleTestNotification()
                }
            } header: {
                Text("Notifications")
            } footer: {
                Text("More preferences coming soon.")
            }
        }
        .navigationTitle("Preferences")
        .navigationBarTitleDisplayMode(.inline)
    }
}

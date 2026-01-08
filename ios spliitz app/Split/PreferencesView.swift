//
//  PreferencesView.swift
//  Split
//
//  Sub-view for app preferences
//

import SwiftUI

struct PreferencesView: View {
    @ObservedObject var viewModel: ProfileViewModel
    @ObservedObject private var appearanceManager = AppearanceManager.shared
    
    var body: some View {
        Form {
            Section {
                Picker("Appearance", selection: $appearanceManager.currentMode) {
                    ForEach(AppearanceMode.allCases, id: \.self) { mode in
                        Text(mode.rawValue).tag(mode)
                    }
                }
            } header: {
                Text("Appearance")
            } footer: {
                Text("Choose your preferred color scheme.")
            }
            
            Section {
                Button("Test Notification (5s)") {
                    NotificationManager.shared.scheduleTestNotification()
                }
            } header: {
                Text("Notifications")
            }
        }
        .navigationTitle("Preferences")
        .navigationBarTitleDisplayMode(.inline)
    }
}

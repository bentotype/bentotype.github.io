//
//  SettingsView.swift
//  Split
//
//  Profile editing and settings
//

import SwiftUI
import PhotosUI

struct SettingsView: View {
    @ObservedObject var viewModel: ProfileViewModel
    @EnvironmentObject var authViewModel: AuthViewModel
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            List {
                Section {
                    NavigationLink(destination: EditProfileView(viewModel: viewModel)) {
                        Label("User Info", systemImage: "person.circle")
                    }
                    
                    NavigationLink(destination: PaymentsView(viewModel: viewModel)) {
                        Label("Payments", systemImage: "creditcard")
                    }
                    
                    NavigationLink(destination: PreferencesView(viewModel: viewModel)) {
                        Label("Preferences", systemImage: "slider.horizontal.3")
                    }
                    
                    NavigationLink(destination: PrivacyView(viewModel: viewModel)) {
                        Label("Privacy", systemImage: "lock.shield")
                    }
                }
                
                Section {
                    Button(role: .destructive, action: { authViewModel.signOut() }) {
                        Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                            .foregroundColor(.red)
                    }
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

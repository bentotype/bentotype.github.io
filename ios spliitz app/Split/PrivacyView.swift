//
//  PrivacyView.swift
//  Split
//
//  Sub-view for privacy and security settings
//

import SwiftUI

struct PrivacyView: View {
    @ObservedObject var viewModel: ProfileViewModel
    @EnvironmentObject var authViewModel: AuthViewModel
    
    var body: some View {
        Form {
            Section {
                Button("Change Password") {
                    viewModel.showingPasswordSheet = true
                }
            } header: {
                Text("Security")
            }
        }
        .navigationTitle("Privacy")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $viewModel.showingPasswordSheet) {
            ChangePasswordSheet(viewModel: viewModel)
        }
    }
}

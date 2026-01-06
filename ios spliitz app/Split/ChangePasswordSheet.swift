//
//  ChangePasswordSheet.swift
//  Split
//
//  Sheet for updating user password
//

import SwiftUI

struct ChangePasswordSheet: View {
    @ObservedObject var viewModel: ProfileViewModel
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    SecureField("Old password", text: $viewModel.oldPassword)
                    SecureField("New password", text: $viewModel.newPassword)
                    SecureField("Confirm new password", text: $viewModel.confirmPassword)
                }
            }
            .navigationTitle("Change Password")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        viewModel.clearPasswordFields()
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Update") {
                        Task { await viewModel.changePassword() }
                    }
                    .disabled(viewModel.isLoading)
                }
            }
        }
    }
}

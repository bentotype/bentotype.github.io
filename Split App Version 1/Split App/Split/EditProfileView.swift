//
//  EditProfileView.swift
//  Split
//
//  Sub-view for editing user details
//

import SwiftUI
import PhotosUI

struct EditProfileView: View {
    @ObservedObject var viewModel: ProfileViewModel
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        Form {
            // Profile Photo Section
            Section {
                VStack(spacing: 12) {
                    HStack(spacing: 16) {
                        // Avatar Display
                        if let data = viewModel.selectedImageData {
                            #if canImport(UIKit)
                            if let uiImage = UIImage(data: data) {
                                Image(uiImage: uiImage)
                                    .resizable()
                                    .aspectRatio(contentMode: .fill)
                                    .frame(width: 80, height: 80)
                                    .clipShape(Circle())
                            }
                            #endif
                        } else if let user = viewModel.userInfo {
                            AvatarView(user: user, size: 80)
                        } else {
                            Text(viewModel.initials)
                                .font(.largeTitle)
                                .fontWeight(.semibold)
                                .foregroundColor(.indigo)
                                .frame(width: 80, height: 80)
                                .background(Color.indigo.opacity(0.15))
                                .clipShape(Circle())
                        }
                        
                        VStack(alignment: .leading, spacing: 6) {
                            PhotosPicker(selection: $viewModel.selectedItem, matching: .images) {
                                Text("Change Photo")
                                    .fontWeight(.medium)
                            }
                            .onChange(of: viewModel.selectedItem) { oldItem, newItem in
                                Task { await viewModel.loadSelection() }
                            }
                            
                            if viewModel.selectedImageData != nil || (viewModel.userInfo?.profilePicture != nil) {
                                Button(role: .destructive) {
                                    Task { await viewModel.removeProfilePicture() }
                                } label: {
                                    Text("Remove Photo")
                                        .font(.caption)
                                        .foregroundColor(.red)
                                }
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .center)
                .padding(.vertical, 8)
                .listRowBackground(Color.clear)
            }
            
            // Name & Info
            Section {
                VStack(alignment: .leading, spacing: 4) {
                    Text("First Name")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    TextField("Required", text: $viewModel.firstName)
                }
                
                VStack(alignment: .leading, spacing: 4) {
                    Text("Last Name")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    TextField("Required", text: $viewModel.lastName)
                }
                
                VStack(alignment: .leading, spacing: 4) {
                    Text("Username")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    TextField("Required", text: $viewModel.username)
                        .autocapitalization(.none)
                }
                
                VStack(alignment: .leading, spacing: 4) {
                    Text("Email")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    TextField("Required", text: $viewModel.email)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                }
            } header: {
                Text("Personal Information")
            }
        }
        .navigationTitle("User Info")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    Task {
                        await viewModel.updateProfile()
                        dismiss()
                    }
                }
                .disabled(viewModel.isLoading)
            }
        }
    }
}

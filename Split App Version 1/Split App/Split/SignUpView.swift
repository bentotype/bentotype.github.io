//
//  SignUpView.swift
//  Split
//
//  Created by Benjamin Chen on 12/23/25.
//

import SwiftUI

struct SignUpView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    
    var body: some View {
        ZStack {
            // Gradient background
            AppBackground()
            
            ScrollView {
                VStack(spacing: 24) {
                    Text("Create Account")
                        .font(.system(size: 32, weight: .bold))
                        .foregroundColor(.primary)
                        .padding(.top, 40)
                    
                    VStack(spacing: 16) {
                        HStack(spacing: 12) {
                            TextField("First name", text: $authViewModel.firstName)
                                .textFieldStyle(CustomTextFieldStyle())
                                .textContentType(.givenName)
                            
                            TextField("Last name", text: $authViewModel.lastName)
                                .textFieldStyle(CustomTextFieldStyle())
                                .textContentType(.familyName)
                        }
                        
                        TextField("Username", text: $authViewModel.username)
                            .textContentType(.username)
                            .textFieldStyle(CustomTextFieldStyle())
                            .autocapitalization(.none)
                            .autocorrectionDisabled(true)
                        
                        TextField("Email", text: $authViewModel.email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .textFieldStyle(CustomTextFieldStyle())
                            .autocapitalization(.none)
                            .autocorrectionDisabled(true)
                        
                        TextField("Phone number (optional)", text: $authViewModel.phoneNumber)
                            .textContentType(.telephoneNumber)
                            .keyboardType(.phonePad)
                            .textFieldStyle(CustomTextFieldStyle())
                        
                        SecureField("Password", text: $authViewModel.password)
                            .textFieldStyle(CustomTextFieldStyle())
                            .textContentType(.newPassword)
                        
                        SecureField("Confirm Password", text: $authViewModel.confirmPassword)
                            .textFieldStyle(CustomTextFieldStyle())
                            .textContentType(.newPassword)
                        
                        if let error = authViewModel.errorMessage {
                            Text(error)
                                .font(.footnote)
                                .foregroundColor(.red)
                                .multilineTextAlignment(.center)
                        }
                        
                        Button(action: { authViewModel.signUp() }) {
                            if authViewModel.isLoading {
                                ProgressView()
                                    .tint(.white)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 14)
                                    .background(Color.indigo)
                                    .cornerRadius(10)
                            } else {
                                Text("Sign Up")
                                    .fontWeight(.semibold)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 14)
                                    .background(Color.indigo)
                                    .foregroundColor(.white)
                                    .cornerRadius(10)
                            }
                        }
                        .disabled(authViewModel.isLoading)
                    }
                    .padding(24)
                    .frame(maxWidth: 500)
                    .background(.regularMaterial) // Adaptive background for dark mode
                    .cornerRadius(16)
                    .shadow(color: .black.opacity(0.1), radius: 20, y: 10)
                    .padding(.horizontal, 24)
                }
            }
            .scrollDismissesKeyboard(.interactively)
        }
    }
}

#Preview {
    SignUpView()
        .environmentObject(AuthViewModel())
}

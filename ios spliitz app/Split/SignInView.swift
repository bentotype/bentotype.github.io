//
//  SignInView.swift
//  Split
//
//  Created by Benjamin Chen on 12/23/25.
//

import SwiftUI

struct SignInView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @State private var showingForgotPassword = false
    
    var body: some View {
        ZStack {
            // Gradient background
            AppBackground()
            
            ScrollView {
                VStack(spacing: 24) {
                    Text("Welcome Back")
                        .font(.system(size: 32, weight: .bold))
                        .foregroundColor(.primary)
                        .padding(.top, 60)
                    
                    VStack(spacing: 16) {
                        TextField("Email or Username", text: $authViewModel.email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .textFieldStyle(CustomTextFieldStyle())
                            .autocapitalization(.none)
                            .autocorrectionDisabled(true)
                        
                        SecureField("Password", text: $authViewModel.password)
                            .textFieldStyle(CustomTextFieldStyle())
                            .textContentType(.password)
                        
                        HStack {
                            Spacer()
                            Button("Forgot Password?") {
                                showingForgotPassword = true
                            }
                            .font(.footnote)
                            .foregroundColor(.indigo)
                        }
                        
                        if let error = authViewModel.errorMessage {
                            Text(error)
                                .font(.footnote)
                                .foregroundColor(.red)
                                .multilineTextAlignment(.center)
                        }
                        
                        Button(action: { authViewModel.signIn() }) {
                            if authViewModel.isLoading {
                                ProgressView()
                                    .tint(.white)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 14)
                                    .background(Color.indigo)
                                    .cornerRadius(10)
                            } else {
                                Text("Log In")
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
                    
                    Spacer()
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .alert("Reset Password", isPresented: $showingForgotPassword) {
                TextField("Enter your email", text: $authViewModel.email)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                Button("Cancel", role: .cancel) { }
                Button("Send Reset Link") {
                    Task {
                        await authViewModel.resetPassword(email: authViewModel.email)
                    }
                }
            } message: {
                Text("Enter the email address associated with your account.")
            }
        }
    }
}

#Preview {
    SignInView()
        .environmentObject(AuthViewModel())
}

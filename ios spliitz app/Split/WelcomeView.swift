//
//  WelcomeView.swift
//  Split
//
//  Created by Benjamin Chen on 12/23/25.
//

import SwiftUI
import AuthenticationServices

struct WelcomeView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @State private var showEmailAuth = false
    @State private var showSignIn = false
    @State private var currentNonce: String?
    @Environment(\.colorScheme) var colorScheme
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Spacer()
                
                // Logo/Branding
                VStack(spacing: 16) {
                    Image(systemName: "receipt") // Placeholder icon
                        .resizable()
                        .scaledToFit()
                        .frame(width: 80, height: 80)
                        .foregroundColor(.indigo)
                    
                    Text("Split")
                        .font(.system(size: 42, weight: .bold, design: .rounded))
                        .foregroundColor(.primary)
                    
                    Text("Simplifying group expenses")
                        .font(.body)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding(.bottom, 48)
                
                // Social Logins
                VStack(spacing: 16) {
                    /*
                     NOTE: "Sign in with Apple" requires a paid Apple Developer Account.
                     Skipping for now as per user request.
                     To enable later:
                     1. Enroll in Apple Developer Program.
                     2. Add "Sign in with Apple" capability in Split.entitlements.
                     3. Uncomment this block.
                     */
                    /*
                    // Apple Sign In
                    SignInWithAppleButton(
                        onRequest: { request in
                            let nonce = AppleAuthUtils.randomNonceString()
                            currentNonce = nonce
                            request.requestedScopes = [.fullName, .email]
                            request.nonce = AppleAuthUtils.sha256(nonce)
                        },
                        onCompletion: { result in
                            switch result {
                            case .success(let authResults):
                                switch authResults.credential {
                                case let appleIDCredential as ASAuthorizationAppleIDCredential:
                                    guard let nonce = currentNonce else {
                                        fatalError("Invalid state: A login callback was received, but no login request was sent.")
                                    }
                                    guard let identityToken = appleIDCredential.identityToken,
                                          let idTokenString = String(data: identityToken, encoding: .utf8) else {
                                        print("Failed to fetch identity token")
                                        return
                                    }
                                    
                                    authViewModel.signInWithApple(idToken: idTokenString, nonce: nonce)
                                    
                                default:
                                    break
                                }
                            case .failure(let error):
                                print("Authorization failed: " + error.localizedDescription)
                            }
                        }
                    )
                    .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
                    .frame(height: 50)
                    .cornerRadius(12)
                    */
                    
                    // Fallback Text
                    Text("Sign in with Apple (Requires Paid Dev Account)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding(.vertical, 8)
                    
                    // Google Sign In (UI Only for now)
                    Button(action: {
                        // Trigger Google Sign In
                    }) {
                        HStack {
                            Image(systemName: "globe") // Placeholder for Google Logo
                            Text("Continue with Google")
                                .fontWeight(.semibold)
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .background(Color(uiColor: .secondarySystemGroupedBackground))
                        .foregroundColor(.primary)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                        )
                        .cornerRadius(12)
                    }
                    
                    // Email Sign Up
                    Button(action: {
                        showEmailAuth = true
                    }) {
                        Text("Sign up with Email")
                            .fontWeight(.semibold)
                            .frame(maxWidth: .infinity)
                            .frame(height: 50)
                            .background(Color.indigo)
                            .foregroundColor(.white)
                            .cornerRadius(12)
                    }
                }
                .padding(.horizontal, 24)
                .frame(maxWidth: 500)
                
                Spacer()
                
                // Footer
                HStack {
                    Text("Already have an account?")
                        .foregroundColor(.secondary)
                    
                    Button("Log in") {
                        showSignIn = true
                    }
                    .foregroundColor(.indigo)
                    .fontWeight(.semibold)
                }
                .padding(.bottom, 24)
            }
            .disabled(authViewModel.isLoading) // Disable interaction during loading
            .overlay {
                if authViewModel.isLoading {
                    ZStack {
                        Color.black.opacity(0.2).ignoresSafeArea()
                        ProgressView()
                            .tint(.white)
                            .scaleEffect(1.5)
                    }
                }
            }
            .navigationDestination(isPresented: $showEmailAuth) {
                SignUpView()
            }
            .navigationDestination(isPresented: $showSignIn) {
                SignInView()
            }
        }
        .background(Color(uiColor: .systemBackground)) // ensure standard background
    }
}

#Preview {
    WelcomeView()
        .environmentObject(AuthViewModel())
}

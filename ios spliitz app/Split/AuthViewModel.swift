//
//  AuthView.swift
//  Split
//
//  AuthViewModel handles authentication state and login/signup
//

import Foundation
import Supabase
import SwiftUI
import Combine

@MainActor
class AuthViewModel: ObservableObject {
    
    // MARK: - Published Properties
    
    @Published var session: Session?
    @Published var currentUser: UserInfo?
    @Published var isLoading = false
    @Published var isCheckingSession = true
    @Published var errorMessage: String?
    
    // Form fields
    @Published var email = ""
    @Published var password = ""
    @Published var confirmPassword = ""
    @Published var firstName = ""
    @Published var lastName = ""
    @Published var username = ""
    @Published var phoneNumber = ""
    
    // MARK: - Private Properties
    
    private let supabase = SupabaseManager.shared
    
    // MARK: - Init
    
    init() {
        // Listen to auth state changes
        Task { [weak self] in
            guard let self else { return }
            for await (event, session) in supabase.auth.authStateChanges {
                switch event {
                case .signedIn:
                    self.session = session
                    if let userId = session?.user.id {
                        await self.fetchCurrentUser(userId: userId)
                    }
                case .signedOut:
                    self.session = nil
                    self.currentUser = nil
                    self.clearForm()
                default:
                    break
                }
            }
        }
        
        // Check for existing session
        Task {
            await checkSession()
        }
    }
    
    // MARK: - Public Methods
    
    func signIn() {
        let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanPassword = password // Passwords can theoretically have spaces, but usually we don't trim them to be safe, or we DO trim if we know policies. Let's start with just Email/Username.
        
        guard !cleanEmail.isEmpty, !cleanPassword.isEmpty else {
            errorMessage = String(localized: "Please enter email/username and password")
            return
        }
        
        Task {
            isLoading = true
            errorMessage = nil
            
            do {
                var signInEmail = cleanEmail
                
                // Check if input is a username (no '@' symbol)
                if !cleanEmail.contains("@") {
                    if let resolvedEmail = try await SupabaseService.shared.getEmailForUsername(username: cleanEmail) {
                        signInEmail = resolvedEmail
                    } else {
                        errorMessage = String(localized: "Username not found")
                        isLoading = false
                        return
                    }
                }
                
                let session = try await supabase.auth.signIn(email: signInEmail, password: cleanPassword)
                self.session = session
                await fetchCurrentUser(userId: session.user.id)
            } catch {
                errorMessage = error.localizedDescription
                // Better error message for common auth failures
                if errorMessage?.contains("Invalid login credentials") == true {
                    errorMessage = String(localized: "Incorrect email/username or password.")
                }
            }
            
            isLoading = false
        }
    }
    
    func signUp() {
        let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanUsername = username.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanPassword = password
        
        // Validation
        guard !cleanEmail.isEmpty else {
            errorMessage = String(localized: "Please enter an email")
            return
        }
        // Basic email format validation
        guard cleanEmail.contains("@"), cleanEmail.contains(".") else {
            errorMessage = String(localized: "Please enter a valid email address")
            return
        }
        guard !cleanPassword.isEmpty else {
            errorMessage = String(localized: "Please enter a password")
            return
        }
        guard cleanPassword == confirmPassword else {
            errorMessage = String(localized: "Passwords do not match")
            return
        }
        guard !firstName.isEmpty else {
            errorMessage = String(localized: "Please enter your first name")
            return
        }
        guard !lastName.isEmpty else {
            errorMessage = String(localized: "Please enter your last name")
            return
        }
        guard !cleanUsername.isEmpty else {
            errorMessage = String(localized: "Please enter a username")
            return
        }
        guard cleanUsername.count > 3 else {
            errorMessage = String(localized: "Username must be longer than 3 characters")
            return
        }
        
        Task {
            isLoading = true
            errorMessage = nil
            
            do {
                // Check if email exists
                let emailExists = try await SupabaseService.shared.checkEmailExists(email: cleanEmail)
                if emailExists {
                    errorMessage = String(localized: "Email has been taken")
                    isLoading = false
                    return
                }
                
                // Check if username exists
                let usernameExists = try await SupabaseService.shared.checkUsernameExists(username: cleanUsername)
                if usernameExists {
                    errorMessage = String(localized: "Username has been taken")
                    isLoading = false
                    return
                }
                
                // Create auth user
                let response = try await supabase.auth.signUp(email: cleanEmail, password: cleanPassword)
                
                // If session is nil, email confirmation is required
                if response.session == nil {
                    errorMessage = String(localized: "Sign-up requires email confirmation. Check your inbox.")
                    isLoading = false
                    return
                }
                
                let user = response.user
                
                // Create user_info record
                let newUser = CreateUserInfo(
                    userId: user.id,
                    username: cleanUsername,
                    email: cleanEmail,
                    firstName: firstName.trimmingCharacters(in: .whitespacesAndNewlines),
                    lastName: lastName.trimmingCharacters(in: .whitespacesAndNewlines),
                    phoneNumber: phoneNumber.isEmpty ? nil : phoneNumber.trimmingCharacters(in: .whitespacesAndNewlines)
                )
                
                try await SupabaseManager.shared.client
                    .from("user_info")
                    .insert(newUser)
                    .execute()
                
                self.session = response.session
                
            } catch {
                errorMessage = error.localizedDescription
            }
            
            isLoading = false
        }
    }
    
    func signOut() {
        Task {
            do {
                try await supabase.auth.signOut()
                session = nil
                currentUser = nil
                clearForm()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
    
    func changePassword(oldPassword: String, newPassword: String, confirmPassword: String) async throws {
        guard !oldPassword.isEmpty, !newPassword.isEmpty, !confirmPassword.isEmpty else {
            throw NSError(domain: "Auth", code: -1, userInfo: [NSLocalizedDescriptionKey: String(localized: "Please fill out all password fields")])
        }
        
        guard newPassword.count >= 6 else {
            throw NSError(domain: "Auth", code: -1, userInfo: [NSLocalizedDescriptionKey: String(localized: "New password must be at least 6 characters")])
        }
        
        guard newPassword == confirmPassword else {
            throw NSError(domain: "Auth", code: -1, userInfo: [NSLocalizedDescriptionKey: String(localized: "New passwords do not match")])
        }
        
        guard newPassword != oldPassword else {
            throw NSError(domain: "Auth", code: -1, userInfo: [NSLocalizedDescriptionKey: String(localized: "New password must be different from old password")])
        }
        
        // Verify old password
        _ = try await supabase.auth.signIn(email: currentUser?.email ?? email, password: oldPassword)
        
        // Update password
        try await supabase.auth.update(user: UserAttributes(password: newPassword))
    }
    
    func signInWithApple(idToken: String, nonce: String) {
        Task {
            isLoading = true
            errorMessage = nil
            
            do {
                let session = try await supabase.auth.signInWithIdToken(credentials: .init(provider: .apple, idToken: idToken, nonce: nonce))
                self.session = session
                
                // Fetch or CREATE user info if it doesn't exist
                if let userId = self.session?.user.id {
                    let info = try? await SupabaseService.shared.getUserInfo(userId: userId)
                    if info != nil {
                        self.currentUser = info
                    } else {
                        // User exists in Auth but not in user_info (first time Apple Sign In)
                        // We need to create a profile.
                        // Ideally we get the name from the Apple Credential in the View and pass it here.
                        // For now we will create a placeholder profile and let them edit it.
                        let randomSuffix = Int.random(in: 1000...9999)
                        let email = session.user.email ?? ""
                        let username = "user\(randomSuffix)"
                        
                        let newUser = CreateUserInfo(
                            userId: userId,
                            username: username,
                            email: email,
                            firstName: "Apple", // Placeholder
                            lastName: "User", // Placeholder
                            phoneNumber: nil
                        )
                        
                        try await SupabaseManager.shared.client
                            .from("user_info")
                            .insert(newUser)
                            .execute()
                            
                        // Fetch again
                        await fetchCurrentUser(userId: userId)
                    }
                }
            } catch {
                errorMessage = error.localizedDescription
            }
            isLoading = false
        }
    }

    func resetPassword(email: String) async {
        guard !email.isEmpty else {
            errorMessage = String(localized: "Please enter your email to reset password")
            return
        }
        
        isLoading = true
        errorMessage = nil
        
        do {
            try await SupabaseService.shared.sendPasswordResetEmail(email: email)
            // Just show a message, no session change
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    // MARK: - Private Methods
    
    private func checkSession() async {
        // Enforce a minimum splash screen duration to prevent flashing
        // and cover any initial app layout setup
        let minimumDuration = Task { try? await Task.sleep(nanoseconds: 1_500_000_000) } // 1.5 seconds
        
        do {
            // Race between session check and 5s timeout
            let session = try await withThrowingTaskGroup(of: Session?.self) { group in
                group.addTask {
                    return try await self.supabase.auth.session
                }
                group.addTask {
                    try await Task.sleep(nanoseconds: 5_000_000_000) // 5 seconds
                    throw NSError(domain: "Auth", code: -1, userInfo: [NSLocalizedDescriptionKey: String(localized: "Session check timed out")])
                }
                // Return the first one that completes (or throws)
                guard let result = try await group.next() else { return nil as Session? }
                group.cancelAll()
                return result
            }
            
            self.session = session
            if let userId = session?.user.id {
                await fetchCurrentUser(userId: userId)
            }
        } catch {
            print("Session check failed or timed out: \(error)")
            self.session = nil
        }
        
        // Wait for timer if session check finished early
        _ = await minimumDuration.result
        
        await MainActor.run {
            self.isCheckingSession = false
        }
    }
    
    private func fetchCurrentUser(userId: UUID) async {
        do {
            currentUser = try await SupabaseService.shared.getUserInfo(userId: userId)
        } catch {
            print("Failed to fetch current user: \(error)")
        }
    }
    
    private func clearForm() {
        email = ""
        password = ""
        confirmPassword = ""
        firstName = ""
        lastName = ""
        username = ""
        phoneNumber = ""
    }
}

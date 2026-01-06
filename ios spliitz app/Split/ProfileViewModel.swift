//
//  ProfileViewModel.swift
//  Split
//

import Foundation
import SwiftUI
import PhotosUI
import Combine
import Supabase
import Auth

@MainActor
class ProfileViewModel: ObservableObject {
    
    @Published var userInfo: UserInfo?
    @Published var firstName = ""
    @Published var lastName = ""
    @Published var username = ""
    @Published var email = ""
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    // Password change
    @Published var showingPasswordSheet = false
    @Published var oldPassword = ""
    @Published var newPassword = ""
    @Published var confirmPassword = ""
    
    // Profile picture
    @Published var selectedItem: PhotosPickerItem?
    @Published var selectedImageData: Data?
    @Published var showingImagePicker = false
    
    func loadSelection() async {
        guard let item = selectedItem else { return }
        
        if let data = try? await item.loadTransferable(type: Data.self) {
            selectedImageData = data
        }
    }
    
    private let service = SupabaseService.shared
    
    // Dashboard Data
    @Published var totalSpent: Double = 0
    @Published var friendBalances: [FriendBalance] = []
    
    struct FriendBalance: Identifiable {
        let id = UUID()
        let friend: UserInfo
        let balance: Double // + means they owe me, - means I owe them
    }
    
    private var lastFetchTime: Date?
    
    init() {
        // Populate from cache immediately
        let cache = AppDataManager.shared
        if let user = cache.userInfo {
            self.userInfo = user
            self.firstName = user.firstName ?? ""
            self.lastName = user.lastName ?? ""
            self.username = user.username ?? ""
            self.email = user.email ?? ""
        }
        self.totalSpent = cache.monthlyTotal
        self.friendBalances = cache.friends.map { FriendBalance(friend: $0.friend, balance: $0.balance) }
            .sorted { abs($0.balance) > abs($1.balance) }
    }
    
    func fetchDashboardData(force: Bool = false) async {
        // Throttling
        if !force, let lastTime = lastFetchTime, Date().timeIntervalSince(lastTime) < 60 {
            return
        }
        
        guard let userId = SupabaseManager.shared.auth.currentSession?.user.id else { return }
        
        isLoading = true
        errorMessage = nil
        
        async let profileTask: () = fetchProfile()
        async let spendingTask: Double = service.fetchMonthlyTotal(userId: userId)
        async let balancesTask: [(UserInfo, Double)] = service.fetchFriendsAndBalances(userId: userId)
        
        do {
            let (_, spending, balances) = try await (profileTask, spendingTask, balancesTask)
            
            self.totalSpent = spending
            self.friendBalances = balances.map { FriendBalance(friend: $0.0, balance: $0.1) }
                .sorted { abs($0.balance) > abs($1.balance) } // Sort by magnitude of debt
            
            lastFetchTime = Date()
            
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    // Kept fetchProfile as internal helper or for just profile updates
    func fetchProfile() async {
        guard let userId = SupabaseManager.shared.auth.currentSession?.user.id else { return }
        
        // Don't set isLoading here if called from fetchDashboardData to avoid flickering
        // But if called alone, we might want it. 
        // For simplicity, we'll let the caller handle loading state if they need specific control, 
        // or just rely on fetchDashboardData for the main view.
        
        do {
            if let info = try await service.getUserInfo(userId: userId) {
                userInfo = info
                firstName = info.firstName ?? ""
                lastName = info.lastName ?? ""
                username = info.username ?? ""
                email = info.email ?? ""
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
    
    // ... rest of existing methods ...
    
    func updateProfile() async {
        guard let userId = SupabaseManager.shared.auth.currentSession?.user.id else { return }
        
        isLoading = true
        errorMessage = nil
        
        do {
            // Upload profile picture if selected
            var profilePictureUrl = userInfo?.profilePicture
            if let data = selectedImageData {
                profilePictureUrl = try await service.uploadProfilePicture(userId: userId, data: data)
            }
            
            let update = UpdateUserInfo(
                firstName: firstName,
                lastName: lastName,
                username: username,
                email: email,
                profilePicture: profilePictureUrl
            )
            
            try await service.updateProfile(userId: userId, update: update)
            
            // Refresh user info
            await fetchProfile()
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    func removeProfilePicture() async {
        guard let userId = SupabaseManager.shared.auth.currentSession?.user.id else { return }
        
        isLoading = true
        errorMessage = nil
        
        do {
            try await service.removeProfilePicture(userId: userId)
            
            // Clear local selection
            selectedImageData = nil
            selectedItem = nil
            
            // Refresh to get updated user info
            await fetchProfile()
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    func changePassword() async {
        guard !oldPassword.isEmpty else {
            errorMessage = "Please enter your current password"
            return
        }
        guard !newPassword.isEmpty else {
            errorMessage = "Please enter a new password"
            return
        }
        guard newPassword == confirmPassword else {
            errorMessage = "Passwords do not match"
            return
        }
        guard newPassword.count >= 6 else {
            errorMessage = "Password must be at least 6 characters"
            return
        }
        
        isLoading = true
        errorMessage = nil
        
        do {
            // Update password via Supabase Auth
            try await SupabaseManager.shared.auth.update(user: UserAttributes(password: newPassword))
            
            showingPasswordSheet = false
            clearPasswordFields()
            DebugLogger.shared.log("Password changed successfully")
        } catch {
            errorMessage = error.localizedDescription
            DebugLogger.shared.log("Password change failed: \(error)")
        }
        
        isLoading = false
    }
    
    func clearPasswordFields() {
        oldPassword = ""
        newPassword = ""
        confirmPassword = ""
    }
    
    func clearMessages() {
        errorMessage = nil
    }
    
    var initials: String {
        let first = firstName.first.map(String.init) ?? ""
        let last = lastName.first.map(String.init) ?? ""
        let result = "\(first)\(last)".uppercased()
        return result.isEmpty ? "U" : result
    }
    
    func updatePaymentInfo(venmo: String?, paypal: String?, cashApp: String?) async {
        guard let userId = SupabaseManager.shared.auth.currentSession?.user.id else { return }
        
        do {
            let update = UpdateUserInfo(
                firstName: nil,
                lastName: nil,
                username: nil,
                email: nil,
                profilePicture: nil,
                venmoUsername: venmo,
                paypalUsername: paypal,
                cashAppUsername: cashApp
            )
            
            try await service.updateProfile(userId: userId, update: update)
            
            // Refresh to get updated user info
            await fetchProfile()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

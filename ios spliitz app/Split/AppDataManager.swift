//
//  AppDataManager.swift
//  Split
//
//  Centralized manager for pre-fetching and caching app data
//

import Foundation
import SwiftUI
import Combine
import Auth

@MainActor
class AppDataManager: ObservableObject {
    static let shared = AppDataManager()
    
    // MARK: - Cached Data
    @Published var friends: [(friend: UserInfo, balance: Double)] = []
    @Published var pendingRequests: [(request: FriendRequest, sender: UserInfo)] = []
    @Published var groups: [GroupWithInfo] = []
    @Published var groupInvites: [GroupWithInfo] = []
    @Published var userInfo: UserInfo?
    @Published var monthlyTotal: Double = 0
    @Published var activities: [Activity] = []
    
    // MARK: - State
    @Published var isPreloading = false
    @Published var preloadComplete = false
    
    private init() {}
    
    /// Pre-fetch all essential data during app startup.
    /// Call this during splash screen and wait for completion.
    func preloadAllData() async {
        guard let userId = SupabaseManager.shared.auth.currentSession?.user.id else {
            preloadComplete = true
            return
        }
        
        isPreloading = true
        
        let service = SupabaseService.shared
        
        // Fetch all data in parallel
        async let friendsTask = service.fetchFriendsAndBalances(userId: userId)
        async let requestsTask = service.getPendingFriendRequests(userId: userId)
        async let groupsTask = service.getUserGroups(userId: userId)
        async let invitesTask = service.getGroupInvites(userId: userId)
        async let userTask = service.getUserInfo(userId: userId)
        async let totalTask = service.fetchMonthlyTotal(userId: userId)
        async let activitiesTask = service.fetchActivities(userId: userId)
        
        do {
            let (friendsResult, requestsResult, groupsResult, invitesResult, userResult, totalResult, activitiesResult) = try await (
                friendsTask,
                requestsTask,
                groupsTask,
                invitesTask,
                userTask,
                totalTask,
                activitiesTask
            )
            
            self.friends = friendsResult
            self.pendingRequests = requestsResult
            self.groups = groupsResult
            self.groupInvites = invitesResult
            self.userInfo = userResult
            self.monthlyTotal = totalResult
            self.activities = activitiesResult
            
            DebugLogger.shared.log("AppDataManager: All data preloaded successfully")
        } catch {
            DebugLogger.shared.log("AppDataManager: Preload error - \(error)")
            // Even on error, mark complete so app doesn't hang
        }
        
        isPreloading = false
        preloadComplete = true
    }
    
    /// Refresh a specific data type (for pull-to-refresh)
    func refreshFriends() async {
        guard let userId = SupabaseManager.shared.auth.currentSession?.user.id else { return }
        
        do {
            friends = try await SupabaseService.shared.fetchFriendsAndBalances(userId: userId)
            pendingRequests = try await SupabaseService.shared.getPendingFriendRequests(userId: userId)
        } catch {
            print("Refresh friends error: \(error)")
        }
    }
    
    func refreshGroups() async {
        guard let userId = SupabaseManager.shared.auth.currentSession?.user.id else { return }
        
        do {
            groups = try await SupabaseService.shared.getUserGroups(userId: userId)
            groupInvites = try await SupabaseService.shared.getGroupInvites(userId: userId)
        } catch {
            print("Refresh groups error: \(error)")
        }
    }
    
    func refreshProfile() async {
        guard let userId = SupabaseManager.shared.auth.currentSession?.user.id else { return }
        
        do {
            userInfo = try await SupabaseService.shared.getUserInfo(userId: userId)
            monthlyTotal = try await SupabaseService.shared.fetchMonthlyTotal(userId: userId)
            activities = try await SupabaseService.shared.fetchActivities(userId: userId)
        } catch {
            print("Refresh profile error: \(error)")
        }
    }
    
    /// Clear all cached data (on logout)
    func clearCache() {
        friends = []
        pendingRequests = []
        groups = []
        groupInvites = []
        userInfo = nil
        monthlyTotal = 0
        activities = []
        preloadComplete = false
    }
}

//
//  FriendsViewModel.swift
//  Split
//

import Foundation
import SwiftUI
import Combine
import Supabase
import Auth

@MainActor
class FriendsViewModel: ObservableObject {
    
    struct FriendWithBalance: Identifiable {
        var id: UUID { friend.id }
        let friend: UserInfo
        let balance: Double
    }
    
    @Published var friends: [FriendWithBalance] = []
    @Published var pendingRequests: [(request: FriendRequest, sender: UserInfo)] = []
    @Published var searchResults: [UserInfo] = []
    @Published var searchQuery = ""
    @Published var isLoading = false
    @Published var isSearching = false
    @Published var errorMessage: String?
    
    private let service = SupabaseService.shared
    private var cancellables = Set<AnyCancellable>()
    private var lastFetchTime: Date?
    
    init() {
        // Populate from cache immediately
        let cache = AppDataManager.shared
        self.friends = cache.friends.map { FriendWithBalance(friend: $0.friend, balance: $0.balance) }
            .sorted { $0.friend.fullName < $1.friend.fullName }
        self.pendingRequests = cache.pendingRequests
        
        // Debounce search query
        $searchQuery
            .debounce(for: .milliseconds(300), scheduler: RunLoop.main)
            .removeDuplicates()
            .sink { [weak self] query in
                guard let self else { return }
                guard !query.isEmpty else { return }
                Task { await self.searchUsers() }
            }
            .store(in: &cancellables)
    }
    
    func fetchFriends(force: Bool = false) async {
        // Throttling: Skip if fetched recently (<60s) unless forced
        if !force, let lastTime = lastFetchTime, Date().timeIntervalSince(lastTime) < 60 {
            return
        }
        
        guard let userId = SupabaseManager.shared.auth.currentSession?.user.id else { return }
        
        isLoading = true
        errorMessage = nil
        
        do {
            // Fetch in background to avoid blocking main thread
            let results = try await Task.detached(priority: .userInitiated) {
                try await self.service.fetchFriendsAndBalances(userId: userId)
            }.value
            
            // Process and update UI on main actor
            friends = results.map { FriendWithBalance(friend: $0.0, balance: $0.1) }
                .sorted { $0.friend.fullName < $1.friend.fullName }
            lastFetchTime = Date()
        } catch is CancellationError {
            // Task cancelled, ignore
        } catch {
            let nsError = error as NSError
            if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled {
                return
            }
            errorMessage = error.localizedDescription
            print("Fetch friends error: \(error)")
        }
        
        isLoading = false
    }
    
    func refreshData() async {
        
        // Force refresh and update cache
        await withTaskGroup(of: Void.self) { group in
            group.addTask { await self.fetchFriends(force: true) }
            group.addTask { await self.fetchPendingRequests(force: true) }
        }
        
        // Sync to cache for other views
        let cache = AppDataManager.shared
        cache.friends = friends.map { ($0.friend, $0.balance) }
        cache.pendingRequests = pendingRequests
    }
    
    func fetchPendingRequests(force: Bool = false) async {
        // Throttling for requests roughly same schedule
        if !force, let lastTime = lastFetchTime, Date().timeIntervalSince(lastTime) < 60 {
            return
        }
        
        guard let userId = SupabaseManager.shared.auth.currentSession?.user.id else { return }
        
        do {
            // Fetch in background to avoid blocking main thread
            let requests = try await Task.detached(priority: .userInitiated) {
                try await self.service.getPendingFriendRequests(userId: userId)
            }.value
            
            pendingRequests = requests
        } catch is CancellationError {
            // Ignore
        } catch {
            let nsError = error as NSError
            if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled {
                return
            }
            print("Failed to fetch pending requests: \(error)")
        }
    }
    
    func searchUsers() async {
        guard !searchQuery.trimmingCharacters(in: .whitespaces).isEmpty else {
            searchResults = []
            return
        }
        
        guard let currentUserId = SupabaseManager.shared.auth.currentSession?.user.id else { return }
        
        isSearching = true
        
        do {
            let results = try await service.searchUsers(query: searchQuery)
            // Filter out current user
            searchResults = results.filter { $0.id != currentUserId }
        } catch {
            if (error as NSError).code == NSURLErrorCancelled || error is CancellationError { return }
            print("Search failed: \(error)")
            searchResults = []
        }
        
        isSearching = false
    }
    
    func sendFriendRequest(to userId: UUID) async {
        guard let currentUserId = SupabaseManager.shared.auth.currentSession?.user.id else { return }
        
        isLoading = true
        errorMessage = nil
        
        do {
            try await service.sendFriendRequest(fromUserId: currentUserId, toUserId: userId)
            // Remove from search results
            searchResults.removeAll { $0.id == userId }
        } catch {
            let nsError = error as NSError
            if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled {
                isLoading = false
                return
            }
            if error is CancellationError {
                isLoading = false
                return
            }
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    func respondToRequest(requesterId: UUID, accept: Bool) async {
        guard let currentUserId = SupabaseManager.shared.auth.currentSession?.user.id else { return }
        
        // Optimistic Update: Remove from pending list immediately
        // This ensures the row disappears from UI instantly, preventing "stuck checkmark"
        if let index = pendingRequests.firstIndex(where: { $0.sender.id == requesterId }) {
            let requestItem = pendingRequests[index]
            pendingRequests.remove(at: index)
            
            // If accepted, verify if we need to add to friends list optimistically
            if accept {
                // Check if already in friends (avoid duplicates)
                if !friends.contains(where: { $0.id == requesterId }) {
                    friends.append(FriendWithBalance(friend: requestItem.sender, balance: 0.0))
                }
            }
        }
        
        errorMessage = nil
        
        // Don't set global isLoading = true here, as it hides the friend list and shows a spinner.
        // We want the action to be seamless.
        
        do {
            print("DEBUG: responding to request from \(requesterId), accept: \(accept)")
            try await service.respondToFriendRequest(requesterId: requesterId, requesteeId: currentUserId, accept: accept)
            print("DEBUG: respond success. Refreshing...")
            
            // Background refresh to ensure consistency (silently)
             Task {
                 await fetchFriends()
                 // We don't need to fetch pending requests again since we managed it manually,
                 // but checking for new ones doesn't hurt.
                 await fetchPendingRequests()
             }
        } catch {
            errorMessage = error.localizedDescription
            // Revert optimistic update if failed (basic error handling)
            // In a real app, we might restore the item, but for now we just show error.
            print("Respond request failed: \(error)")
            await fetchPendingRequests() // Force valid state
        }
    }
    
    func removeFriend(friendId: UUID) async {
        guard let currentUserId = SupabaseManager.shared.auth.currentSession?.user.id else { return }
        
        isLoading = true
        errorMessage = nil
        
        do {
            try await service.removeFriend(userId: currentUserId, friendId: friendId)
            friends.removeAll { $0.id == friendId }
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    func blockFriend(friendId: UUID) async {
        guard let currentUserId = SupabaseManager.shared.auth.currentSession?.user.id else { return }
        
        isLoading = true
        errorMessage = nil
        
        do {
            try await service.blockFriend(userId: currentUserId, friendId: friendId)
            friends.removeAll { $0.id == friendId }
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    func clearMessages() {
        errorMessage = nil
    }
}

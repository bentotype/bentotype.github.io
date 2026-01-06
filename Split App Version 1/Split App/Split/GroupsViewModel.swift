//
//  GroupsViewModel.swift
//  Split
//

import Foundation
import SwiftUI
import Combine
import Supabase
import Auth

@MainActor
class GroupsViewModel: ObservableObject {
    
    @Published var groups: [GroupWithInfo] = []
    @Published var groupInvites: [GroupWithInfo] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    // Track if initial load has happened (prevents re-fetch on tab switch)
    var hasLoadedInitially = false
    
    // Create group form
    @Published var newGroupTitle = ""
    @Published var newGroupDescription = ""
    @Published var showingCreateSheet = false
    
    // Edit group
    @Published var editingGroup: GroupInfo?
    @Published var editGroupTitle = ""
    @Published var editGroupDescription = ""
    @Published var showingEditSheet = false
    
    private let service = SupabaseService.shared
    
    init() {
        // Populate from cache immediately
        let cache = AppDataManager.shared
        self.groups = cache.groups
        self.groupInvites = cache.groupInvites
        self.hasLoadedInitially = cache.preloadComplete
    }
    
    func fetchGroups() async {
        guard let userId = SupabaseManager.shared.auth.currentSession?.user.id else { return }
        
        isLoading = true
        errorMessage = nil
        
        do {
            groups = try await service.getUserGroups(userId: userId)
        } catch is CancellationError {
            // Ignore
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    func fetchGroupInvites() async {
        guard let userId = SupabaseManager.shared.auth.currentSession?.user.id else { return }
        
        do {
            groupInvites = try await service.getGroupInvites(userId: userId)
        } catch is CancellationError {
            // Ignore
        } catch {
            let nsError = error as NSError
            if nsError.code != NSURLErrorCancelled {
                print("Failed to fetch group invites: \(error)")
            }
        }
    }
    
    func refreshData() async {
        // Refresh all data: Groups, Invites, and potentially expenses (if viewed)
        // User requested scanning for new proposed expenses. 
        // Although this view doesn't list them, refreshing groups might update metadata if available.
        // We concurrently fetch groups and invites.
        await withTaskGroup(of: Void.self) { group in
            group.addTask { await self.fetchGroups() }
            group.addTask { await self.fetchGroupInvites() }
        }
    }
    
    func createGroup() async {
        guard let userId = SupabaseManager.shared.auth.currentSession?.user.id else { return }
        guard !newGroupTitle.trimmingCharacters(in: .whitespaces).isEmpty else {
            errorMessage = "Please enter a group title"
            return
        }
        
        isLoading = true
        errorMessage = nil
        errorMessage = nil
        
        do {
            let _ = try await service.createGroup(
                title: newGroupTitle.trimmingCharacters(in: .whitespaces),
                description: newGroupDescription.isEmpty ? nil : newGroupDescription,
                ownerId: userId
            )
            
            
            newGroupTitle = ""
            newGroupDescription = ""
            showingCreateSheet = false
            
            await fetchGroups()
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    func updateGroup() async {
        guard let group = editingGroup else { return }
        guard !editGroupTitle.trimmingCharacters(in: .whitespaces).isEmpty else {
            errorMessage = "Please enter a group title"
            return
        }
        
        isLoading = true
        errorMessage = nil
        errorMessage = nil
        
        do {
            try await service.updateGroup(
                groupId: group.id,
                title: editGroupTitle.trimmingCharacters(in: .whitespaces),
                description: editGroupDescription.isEmpty ? nil : editGroupDescription
            )
            
            
            showingEditSheet = false
            editingGroup = nil
            
            await fetchGroups()
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    func deleteGroup(groupId: UUID) async {
        guard let userId = SupabaseManager.shared.auth.currentSession?.user.id else { return }
        
        isLoading = true
        errorMessage = nil
        errorMessage = nil
        
        do {
            try await service.deleteGroup(groupId: groupId, userId: userId)
            showingEditSheet = false
            editingGroup = nil
            
            await fetchGroups()
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    func respondToInvite(groupId: UUID, accept: Bool) async {
        guard let userId = SupabaseManager.shared.auth.currentSession?.user.id else { return }
        
        // Optimistic Update: Remove from list immediately
        if let index = groupInvites.firstIndex(where: { $0.groupId == groupId }) {
            let invite = groupInvites[index]
            groupInvites.remove(at: index)
            
            // If accepted, add to groups list optimistically
            if accept, let info = invite.groupInfo {
                 groups.append(GroupWithInfo(groupId: invite.groupId, invite: false, groupInfo: info))
            }
        }
        
        errorMessage = nil
        // Don't set isLoading = true to avoid UI flickering
        
        do {
            try await service.respondToGroupInvite(userId: userId, groupId: groupId, accept: accept)
            
            // Silent refresh
            Task {
                await fetchGroupInvites()
                 if accept {
                     await fetchGroups()
                 }
            }
        } catch {
            errorMessage = error.localizedDescription
            // Restore state if failed
            await fetchGroupInvites()
        }
    }
    
    func startEditingGroup(_ group: GroupInfo) {
        editingGroup = group
        editGroupTitle = group.groupTitle ?? ""
        editGroupDescription = group.description ?? ""
        showingEditSheet = true
    }
    
    func clearMessages() {
        errorMessage = nil
    }
}

//
//  GroupDetailViewModel.swift
//  Split
//

import Foundation
import SwiftUI
import Combine
import Supabase
import Auth

@MainActor
class GroupDetailViewModel: ObservableObject {
    
    @Published var group: GroupInfo
    @Published var members: [UserInfo] = []
    @Published var pendingExpenses: [ExpenseWithInfo] = []
    @Published var expenseActivity: [ExpenseInfo] = []
    @Published var availableFriends: [UserInfo] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    // Invite sheet
    @Published var showingInviteSheet = false
    
    // Create expense sheet
    // Create expense sheet
    @Published var showingCreateExpenseSheet = false
    @Published var showingExpenseOptions = false
    @Published var showingScannerSheet = false
    
    // Scanned data
    @Published var scannedAmount: Double?
    @Published var scannedExplanation: String?
    @Published var scannedSplits: [UUID: Double]?
    
    private let service = SupabaseService.shared
    
    init(group: GroupInfo) {
        self.group = group
    }
    
    func fetchAll() async {
        await fetchMembers()
        await fetchPendingExpenses()
        await fetchExpenseActivity()
        // Self-healing: Check for missing dues
        do {
            try await service.reconcileDues(groupId: group.id)
        } catch {
            let nsError = error as NSError
            if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled {
                return
            }
            if error is CancellationError {
                return
            }
            print("Reconciliation failed: \(error)")
        }
    }
    
    func fetchMembers() async {
        isLoading = true
        
        do {
            members = try await service.getGroupMembers(groupId: group.id)
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
    
    func fetchPendingExpenses() async {
        guard let userId = SupabaseManager.shared.auth.currentSession?.user.id else { return }
        
        do {
            pendingExpenses = try await service.getGroupPendingExpenses(groupId: group.id, userId: userId)
        } catch {
            let nsError = error as NSError
            if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled {
                return
            }
            if error is CancellationError {
                return
            }
            print("Failed to fetch pending expenses: \(error)")
        }
    }
    
    func fetchExpenseActivity() async {
        do {
            expenseActivity = try await service.getGroupExpenses(groupId: group.id)
        } catch {
            let nsError = error as NSError
            if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled {
                return
            }
            if error is CancellationError {
                return
            }
            print("Failed to fetch expense activity: \(error)")
        }
    }
    
    func approveExpense(expenseId: UUID) async {
        guard let userId = SupabaseManager.shared.auth.currentSession?.user.id else { return }
        
        isLoading = true
        do {
            // This will approve AND create the dues
            try await service.approveExpense(expenseId: expenseId, userId: userId)
            
            // Refresh
            await fetchPendingExpenses()
            await fetchExpenseActivity()
            
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
    
    func deleteExpense(expense: ExpenseInfo) async {
        guard let currentUserId = SupabaseManager.shared.auth.currentSession?.user.id else { return }
        
        let isPayer = expense.payerId == currentUserId
        let isGroupOwner = group.ownerId == currentUserId
        
        // Only allow if Owner OR Payer
        guard isPayer || isGroupOwner else {
            errorMessage = "Only the payer or group owner can delete this expense"
            return
        }
        
        isLoading = true
        
        do {
            try await service.deleteExpense(expenseId: expense.id)
            
            await fetchExpenseActivity()
            await fetchPendingExpenses() // In case it was pending
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
    
    func fetchAvailableFriends() async {
        guard let userId = SupabaseManager.shared.auth.currentSession?.user.id else { return }
        
        do {
            let allFriends = try await service.getFriends(userId: userId)
            let memberIds = Set(members.map { $0.id })
            availableFriends = allFriends.filter { !memberIds.contains($0.id) }
        } catch {
            let nsError = error as NSError
            if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled {
                return
            }
            if error is CancellationError {
                return
            }
            print("Failed to fetch friends: \(error)")
        }
    }
    
    func inviteFriend(userId: UUID) async {
        isLoading = true
        errorMessage = nil
        
        do {
            try await service.inviteFriendToGroup(userId: userId, groupId: group.id)
            availableFriends.removeAll { $0.id == userId }
            availableFriends.removeAll { $0.id == userId }
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
    
    func removeMember(userId: UUID) async {
        guard let currentUserId = SupabaseManager.shared.auth.currentSession?.user.id else { return }
        
        isLoading = true
        errorMessage = nil
        
        do {
            try await service.removeMemberFromGroup(userId: userId, groupId: group.id, currentUserId: currentUserId)
            members.removeAll { $0.id == userId }
            members.removeAll { $0.id == userId }
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

    
    var isOwner: Bool {
        guard let userId = SupabaseManager.shared.auth.currentSession?.user.id else { return false }
        return group.ownerId == userId
    }
    
    func getMemberName(for payerId: UUID?) -> String {
        guard let payerId = payerId else { return "Not set" }
        return members.first { $0.id == payerId }?.fullName ?? "Unknown"
    }
    
    func clearMessages() {
        errorMessage = nil
    }
}

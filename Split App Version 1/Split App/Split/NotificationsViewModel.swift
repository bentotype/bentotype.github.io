//
//  NotificationsViewModel.swift
//  Split
//
//  Created by Benjamin Chen on 12/26/25.
//

import Foundation
import SwiftUI
import Combine
import Auth
import Supabase

@MainActor
class NotificationsViewModel: ObservableObject {
    @Published var notifications: [AppNotification] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    // Add logic to periodically refresh or listen to realtime changes in future steps
    // For now, simpler fetch logic.
    
    private let service = SupabaseService.shared
    
    func fetchNotifications() async {
        guard let userId = SupabaseManager.shared.auth.currentSession?.user.id else { return }
        
        isLoading = true
        errorMessage = nil
        
        do {
            let items = try await service.fetchNotifications(userId: userId)
            notifications = items
        } catch {
            print("Fetch notifications error: \(error)")
            // Don't show error to user for background fetch usually, but here we can
            // errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    func markAsRead() async {
        guard let userId = SupabaseManager.shared.auth.currentSession?.user.id else { return }
        
        // Optimistic update
        for index in notifications.indices {
            notifications[index].isRead = true
        }
        
        do {
            try await service.markAllNotificationsAsRead(userId: userId)
        } catch {
            print("Failed to mark notifications as read: \(error)")
        }
    }
}

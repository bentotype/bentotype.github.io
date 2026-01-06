//
//  NotificationManager.swift
//  Split
//
//  Created by Benjamin Chen on 12/22/25.
//

import Foundation
import UserNotifications
import Supabase
import Realtime
import Combine

@MainActor
class NotificationManager: ObservableObject {
    static let shared = NotificationManager()
    
    private let client = SupabaseManager.shared.client
    private var channels: [RealtimeChannelV2] = []
    
    @Published var permissionGranted = false
    
    // Badge Counts
    @Published var homeBadgeCount: Int = 0
    @Published var friendsBadgeCount: Int = 0
    @Published var groupsBadgeCount: Int = 0
    @Published var profileBadgeCount: Int = 0 // Tracks unread app_notifications
    
    // Hold references to tasks to keep them alive if needed
    private var tasks: [Task<Void, Never>] = []
    
    private init() {
        checkPermission()
    }
    
    func checkPermission() {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                self.permissionGranted = (settings.authorizationStatus == .authorized)
            }
        }
    }
    
    func requestPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
            DispatchQueue.main.async {
                self.permissionGranted = granted
                if granted {
                    print("Notification permission granted")
                } else if let error = error {
                    print("Notification permission error: \(error.localizedDescription)")
                }
            }
        }
    }
    
    func setupListeners(userId: UUID) async {
        // Clear existing channels
        for channel in channels {
            await channel.unsubscribe()
        }
        channels.removeAll()
        
        // Cancel previous tasks
        for task in tasks {
            task.cancel()
        }
        tasks.removeAll()
        
        print("Setting up realtime listeners for user: \(userId)")
        
        // 1. Friend Requests Listener
        let friendChannel = client.channel("friend_requests")
        let friendStream = friendChannel.postgresChange(
            AnyAction.self,
            schema: "public",
            table: "friend_request",
            filter: .eq("id_2", value: userId.uuidString)
        )
        
        do {
            try await friendChannel.subscribeWithError()
        } catch {
            print("Error subscribing to friend requests: \(error)")
        }
        channels.append(friendChannel)
        
        let friendTask = Task {
            for await _ in friendStream {
                 self.scheduleNotification(
                    title: "New Friend Request",
                    body: "You have received a new friend request."
                )
                await self.fetchFriendsBadge(userId: userId)
            }
        }
        tasks.append(friendTask)
        
        // 2. Group Invites Listener
        let groupChannel = client.channel("group_invites")
        let groupStream = groupChannel.postgresChange(
            AnyAction.self,
            schema: "public",
            table: "split_groups", // Updated table name to match SupabaseService
            filter: .eq("user_id", value: userId.uuidString)
        )
        
        do {
            try await groupChannel.subscribeWithError()
        } catch {
            print("Error subscribing to group invites: \(error)")
        }
        channels.append(groupChannel)
        
        let groupTask = Task {
            for await action in groupStream {
                // Filter specifically for inserts (invites or adds)
                if case .insert(_) = action {
                    self.scheduleNotification(
                        title: "Group Update",
                        body: "You have been added to or invited to a group."
                    )
                }
                await self.fetchGroupsBadge(userId: userId)
            }
        }
        tasks.append(groupTask)
        
        // 3. Expense Proposals Listener
        let expenseChannel = client.channel("expenses")
        let expenseStream = expenseChannel.postgresChange(
            AnyAction.self,
            schema: "public",
            table: "expense",
            filter: .eq("user_id", value: userId.uuidString)
        )
        
        do {
            try await expenseChannel.subscribeWithError()
        } catch {
            print("Error subscribing to expenses: \(error)")
        }
        channels.append(expenseChannel)
        
        let expenseTask = Task {
            for await action in expenseStream {
                if case .insert(_) = action {
                    self.scheduleNotification(
                        title: "New Expense", 
                        body: "A new expense has been added for your review."
                    )
                }
                await self.fetchHomeBadge(userId: userId)
                await self.fetchGroupsBadge(userId: userId)
            }
        }
        tasks.append(expenseTask)
        
        // 4. Notifications Listener (For Profile Badge)
        let notifChannel = client.channel("notifications")
        let notifStream = notifChannel.postgresChange(
            AnyAction.self,
            schema: "public",
            table: "notifications",
            filter: .eq("user_id", value: userId.uuidString)
        )
        
        do {
            try await notifChannel.subscribeWithError()
        } catch {
            print("Error subscribing to notifications: \(error)")
        }
        channels.append(notifChannel)
        
        let notifTask = Task {
            for await _ in notifStream {
                // Any change to notifications (insert/update) refreshes the badge
                await self.fetchProfileBadge(userId: userId)
            }
        }
        tasks.append(notifTask)
        
        // Initial Badge Fetch
        refreshBadges(userId: userId)
    }
    

    
    // MARK: - Badge Logic
    
    func refreshBadges(userId: UUID) {
        Task {
            await fetchHomeBadge(userId: userId)
            await fetchFriendsBadge(userId: userId)
            await fetchGroupsBadge(userId: userId)
            await fetchProfileBadge(userId: userId)
        }
    }
    
    func fetchProfileBadge(userId: UUID) async {
        struct CountResult: Decodable {
            let count: Int
        }
        
        do {
            let response = try await client
                .from("notifications")
                .select("count", head: true)
                .eq("user_id", value: userId)
                .eq("is_read", value: false)
                .execute()
            
            DispatchQueue.main.async {
                self.profileBadgeCount = response.count ?? 0
            }
        } catch {
            print("Error fetching profile badge: \(error)")
        }
    }
    
    private func fetchHomeBadge(userId: UUID) async {
        // Count expenses due in the next 3 days
        let calendar = Calendar.current
        let today = Date()
        let threeDaysLater = calendar.date(byAdding: .day, value: 3, to: today)!
        

        
        do {
            // We need to join expense to get user's expenses, then expense_info to check date
            // Simplified: Query expense_info where group_id IN (user_groups) AND date BETWEEN now AND 3 days
            // For now, let's use the SupabaseService's logic but just count
            let count = try await SupabaseService.shared.fetchCalendarEventsCount(userId: userId, start: today, end: threeDaysLater)
            DispatchQueue.main.async {
                self.homeBadgeCount = count
            }
        } catch {
            print("Error fetching home badge: \(error)")
        }
    }
    
    private func fetchFriendsBadge(userId: UUID) async {
        struct CountResult: Decodable {
            let count: Int
        }
        
        do {
            let response = try await client
                .from("friend_request")
                .select("count", head: true) // Head request for count
                .eq("id_2", value: userId)
                .execute()
            
            DispatchQueue.main.async {
                self.friendsBadgeCount = response.count ?? 0
            }
        } catch {
            print("Error fetching friends badge: \(error)")
        }
    }
    
    private func fetchGroupsBadge(userId: UUID) async {
        do {
            // 1. Group Invites (Use service directly to assume consistency with UI)
            let invites = try await SupabaseService.shared.getGroupInvites(userId: userId)
            let inviteCount = invites.count
            
            // 2. Pending Proposals
            let proposalCount = try await SupabaseService.shared.fetchPendingProposalsCount(userId: userId)
            
            print("DEBUG: Groups Badge - Invites: \(inviteCount), Proposals: \(proposalCount)")
            
            DispatchQueue.main.async {
                self.groupsBadgeCount = inviteCount + proposalCount
            }
        } catch {
            print("Error fetching groups badge: \(error)")
        }
    }

    func scheduleDeadlineNotification(for expense: ExpenseInfo) {
        guard let date = expense.date else { return }
        
        // Notify 1 day before at 9 AM
        let calendar = Calendar.current
        guard let notificationDate = calendar.date(byAdding: .day, value: -1, to: date) else { return }
        
        var components = calendar.dateComponents([.year, .month, .day], from: notificationDate)
        components.hour = 9
        components.minute = 0
        
        let content = UNMutableNotificationContent()
        content.title = "Expense Due Soon"
        content.body = "'\(expense.title ?? "Expense")' is due tomorrow."
        content.sound = .default
        
        // If date is in past/too close, this trigger might fail or fire immediately. 
        // Use time interval for testing if needed.
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
        
        let request = UNNotificationRequest(
            identifier: "due_\(expense.id)",
            content: content,
            trigger: trigger
        )
        
        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("Error scheduling deadline: \(error)")
            }
        }
    }
    
    func scheduleNotification(title: String, body: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        
        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: nil // Deliver immediately
        )
        
        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("Error scheduling notification: \(error)")
            }
        }
    }
    
    func scheduleTestNotification() {
        let content = UNMutableNotificationContent()
        content.title = "Test Notification"
        content.body = "This is a test notification from the Split app."
        content.sound = .default
        
        // Trigger in 5 seconds
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 5, repeats: false)
        
        let request = UNNotificationRequest(
            identifier: "test_notification_\(Date().timeIntervalSince1970)",
            content: content,
            trigger: trigger
        )
        
        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("Error scheduling test notification: \(error)")
            } else {
                print("Test notification scheduled for 5 seconds from now")
            }
        }
    }
}

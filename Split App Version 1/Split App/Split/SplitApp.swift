//
//  SplitApp.swift
//  Split
//
//  Created by Benjamin Chen on 12/21/25.
//

import SwiftUI
import BackgroundTasks
import Auth

@main
struct SplitApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @Environment(\.scenePhase) private var scenePhase
    
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .background {
                appDelegate.scheduleAppRefresh()
            }
        }
    }
}

class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    
    // Identifier must match Info.plist
    let backgroundTaskID = "io.splitapp.refresh"
    
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        
        // Register Background Task
        BGTaskScheduler.shared.register(forTaskWithIdentifier: backgroundTaskID, using: nil) { task in
            self.handleAppRefresh(task: task as! BGAppRefreshTask)
        }
        
        return true
    }
    
    func scheduleAppRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: backgroundTaskID)
        // Earliest run 1 minute from now (iOS decides actual time, likely 15+ mins)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 60)
        
        do {
            try BGTaskScheduler.shared.submit(request)
            // print("Background Task Scheduled")
        } catch {
            print("Could not schedule app refresh: \(error)")
        }
    }
    
    func handleAppRefresh(task: BGAppRefreshTask) {
        // Schedule next refresh
        scheduleAppRefresh()
        
        // Create a Swift Task to perform the work
        let backgroundTask = Task {
            // Check for new notifications
            if let userId = SupabaseManager.shared.auth.currentUser?.id {
                 // 1. Fetch unread count
                if let notifications = try? await SupabaseService.shared.fetchNotifications(userId: userId) {
                    let count = notifications.filter { !$0.isRead }.count
                    if count > 0 {
                        // 2. Trigger Local Notification
                        let content = UNMutableNotificationContent()
                        content.title = "New Activity"
                        content.body = "You have \(count) new notifications."
                        content.sound = .default
                        
                        let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
                        try? await UNUserNotificationCenter.current().add(request)
                    }
                }
            }
            // Mark BG task as completed on success
            task.setTaskCompleted(success: true)
        }
        
        // Handle expiration by cancelling the Swift Task
        task.expirationHandler = {
            backgroundTask.cancel()
        }
    }
    
    // Handle foreground notifications
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        // Show notification even when app is in foreground
        completionHandler([.banner, .sound, .badge])
    }
}


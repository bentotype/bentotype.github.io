//
//  ActivityButton.swift
//  Split
//
//  A bell icon button that shows the Activity/Notifications sheet.
//

import SwiftUI

struct ActivityButton: View {
    let action: () -> Void
    @StateObject private var viewModel = NotificationsViewModel()
    
    var unreadCount: Int {
        viewModel.activities.filter { !$0.isRead }.count
    }
    
    var body: some View {
        Button(action: action) {
            Image(systemName: unreadCount > 0 ? "bell.badge.fill" : "bell.fill")
                .font(.system(size: 20))
                .foregroundColor(.primary)
        }
        .offset(y: 24)
        .task {
            await viewModel.fetchActivities()
        }
    }
}

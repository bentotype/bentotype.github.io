import SwiftUI

struct NotificationsView: View {
    @StateObject private var viewModel = NotificationsViewModel()
    
    var body: some View {
        NavigationStack {
            ZStack {
                // Background gradient
                AppBackground()
                
                // Content
                if viewModel.isLoading && viewModel.notifications.isEmpty {
                    ProgressView()
                } else if viewModel.notifications.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "bell.slash")
                            .font(.system(size: 48))
                            .foregroundColor(.secondary.opacity(0.5))
                        Text("No notifications yet")
                            .font(.headline)
                            .foregroundColor(.secondary)
                    }
                } else {
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(viewModel.notifications) { notification in
                                NotificationRow(notification: notification)
                                    .padding(.horizontal)
                            }
                        }
                        .padding(.vertical)
                    }
                }
            }
            .navigationTitle("Activity")
            .refreshable {
                await viewModel.fetchNotifications()
            }
            .task {
                await viewModel.fetchNotifications()
                await viewModel.markAsRead()
            }
        }
    }
    
}

struct NotificationRow: View {
    let notification: AppNotification
    
    var iconName: String {
        switch notification.type {
        case .friendRequest: return "person.badge.plus"
        case .groupInvite: return "person.3.fill"
        case .expenseProposal: return "banknote"
        case .payingDues: return "dollarsign.circle"
        case .requestAccepted: return "checkmark.circle"
        }
    }
    
    var iconColor: Color {
        switch notification.type {
        case .friendRequest: return .blue
        case .groupInvite: return .indigo
        case .expenseProposal: return .orange
        case .payingDues: return .green
        case .requestAccepted: return .green
        }
    }
    
    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            Circle()
                .fill(iconColor.opacity(0.1))
                .frame(width: 40, height: 40)
                .overlay(
                    Image(systemName: iconName)
                        .foregroundColor(iconColor)
                        .font(.system(size: 18))
                )
            
            VStack(alignment: .leading, spacing: 4) {
                Text(notification.title)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.primary)
                
                Text(notification.message)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
                
                Text(notification.createdAt.formatted(.relative(presentation: .named)))
                    .font(.caption2)
                    .foregroundColor(.secondary.opacity(0.7))
            }
            
            Spacer()
            
            if !notification.isRead {
                Circle()
                    .fill(Color.blue)
                    .frame(width: 8, height: 8)
                    .padding(.top, 6)
            }
        }
        .padding(.vertical, 8)
    }
    }



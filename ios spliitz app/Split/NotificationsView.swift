import SwiftUI

struct NotificationsView: View {
    @StateObject private var viewModel = NotificationsViewModel()
    
    var body: some View {
        NavigationStack {
            ZStack {
                // Background gradient
                AppBackground()
                
                // Content
                if viewModel.isLoading && viewModel.activities.isEmpty {
                    ProgressView()
                } else if viewModel.activities.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "bell.slash")
                            .font(.system(size: 48))
                            .foregroundColor(.secondary.opacity(0.5))
                        Text("No activity yet")
                            .font(.headline)
                            .foregroundColor(.secondary)
                    }
                } else {
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(viewModel.activities) { activity in
                                ActivityRow(activity: activity)
                                    .padding(.horizontal)
                            }
                        }
                        .padding(.vertical)
                    }
                }
            }
            .navigationTitle("Activity")
            .refreshable {
                await viewModel.fetchActivities()
            }
            .task {
                await viewModel.fetchActivities()
                await viewModel.markAsRead()
            }
        }
    }
    
}

struct ActivityRow: View {
    let activity: Activity
    
    var iconName: String {
        switch activity.type {
        case .friendRequest: return "person.badge.plus"
        case .groupInvite: return "person.3.fill"
        case .expenseProposed: return "banknote"
        case .duesPaid: return "dollarsign.circle"
        case .friends: return "person.2.fill" 
        case .expenseFinalized: return "checkmark.seal.fill"
        case .paymentDueCustom: return "calendar.badge.exclamationmark"
        case .paymentConfirmed: return "checkmark.circle.fill"
        case .paymentDue7Days: return "clock.arrow.circlepath"
        case .joinedGroup: return "person.3.sequence.fill"
        case .test: return "hammer.fill"
        }
    }
    
    var iconColor: Color {
        switch activity.type {
        case .friendRequest: return .blue
        case .groupInvite: return .indigo
        case .expenseProposed: return .orange
        case .duesPaid: return .green
        case .friends: return .blue
        case .expenseFinalized: return .purple
        case .paymentDueCustom: return .red
        case .paymentConfirmed: return .green
        case .paymentDue7Days: return .orange
        case .joinedGroup: return .indigo
        case .test: return .gray
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
                Text(activity.title)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.primary)
                
                Text(activity.message)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
                
                Text(activity.createdAt.formatted(.relative(presentation: .named)))
                    .font(.caption2)
                    .foregroundColor(.secondary.opacity(0.7))
            }
            
            Spacer()
            
            if !activity.isRead {
                Circle()
                    .fill(Color.blue)
                    .frame(width: 8, height: 8)
                    .padding(.top, 6)
            }
        }
        .padding(.vertical, 8)
    }
}



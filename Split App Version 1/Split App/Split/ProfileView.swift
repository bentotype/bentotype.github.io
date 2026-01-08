//
//  ProfileView.swift
//  Split
//
//  Profile editing view with photo upload and password change
//

import SwiftUI
import PhotosUI
#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

struct ProfileView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @StateObject private var viewModel = ProfileViewModel()
    @StateObject private var notificationsViewModel = NotificationsViewModel()
    @Binding var selectedTab: Int
    @State private var showingSettings = false
    
    // Default init for preview or when binding not strictly required (optional, but better to enforce)
    init(selectedTab: Binding<Int> = .constant(3)) {
        self._selectedTab = selectedTab
    }
    
    var body: some View {
        NavigationStack {

                    ScrollView {
                        VStack(spacing: 24) {
                            // Custom Header with Settings aligned to Title
                            HStack {
                                Text("Profile")
                                    .font(.largeTitle)
                                    .fontWeight(.bold)
                                
                                Spacer()
                                
                                Button(action: { showingSettings = true }) {
                                    Image(systemName: "gearshape.fill")
                                        .font(.title2) // Slightly larger to match header weight
                                        .foregroundColor(.gray)
                                        .padding(8)
                                        .background(Color(uiColor: .systemGray6))
                                        .clipShape(Circle())
                                }
                            }
                            .padding(.horizontal)
                            .padding(.top, 16)
                            
                            // 1. Avatar & Name (Centered)
                            VStack(spacing: 12) {
                                if let user = viewModel.userInfo {
                                    AvatarView(user: user, size: 100)
                                } else {
                                    Text(viewModel.initials)
                                        .font(.system(size: 36))
                                        .fontWeight(.semibold)
                                        .foregroundColor(.indigo)
                                        .frame(width: 100, height: 100)
                                        .background(Color.indigo.opacity(0.15))
                                        .clipShape(Circle())
                                }
                                
                                VStack(spacing: 4) {
                                    Text(viewModel.firstName.isEmpty ? "Welcome" : "\(viewModel.firstName) \(viewModel.lastName)")
                                        .font(.title2)
                                        .fontWeight(.bold)
                                    
                                    if !viewModel.username.isEmpty {
                                        Text("@\(viewModel.username)")
                                            .foregroundColor(.secondary)
                                    }
                                }
                            }
                            // .padding(.top) removed as header handles spacing
                            
                            // 2. Spending Metric Card
                            VStack(spacing: 8) {
                                Text("Total Spent This Month")
                                // ... rest of spending card ...
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                                
                                if viewModel.isLoading {
                                    ProgressView()
                                } else {
                                    Text(String(format: "$%.2f", viewModel.totalSpent))
                                        .font(.system(size: 36, weight: .bold))
                                        .foregroundColor(.primary)
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .padding(20)
                            .background(Color(uiColor: .secondarySystemGroupedBackground))
                            .cornerRadius(16)
                            .shadow(color: .black.opacity(0.05), radius: 8, y: 2)
                            .padding(.horizontal)
                            
                            // 3. Activity Section (Notifications)
                            VStack(alignment: .leading, spacing: 16) {
                                Text("Activity")
                                    .font(.headline)
                                    .padding(.horizontal)
                                
                                if notificationsViewModel.isLoading && notificationsViewModel.notifications.isEmpty {
                                    ProgressView()
                                        .frame(maxWidth: .infinity)
                                        .padding()
                                } else if notificationsViewModel.notifications.isEmpty {
                                    Text("No recent activity.")
                                        .foregroundColor(.secondary)
                                        .frame(maxWidth: .infinity, alignment: .center)
                                        .padding()
                                } else {
                                    LazyVStack(spacing: 12) {
                                        ForEach(notificationsViewModel.notifications) { notification in
                                            Button {
                                                // Handle deep linking logic
                                                if notification.title.contains("Friend Request") || notification.message.contains("friend request") {
                                                    // Switch to Friends Tab
                                                    selectedTab = 1
                                                }
                                                // Add other cases like "Group Invite" -> Tab 2 if needed
                                            } label: {
                                                NotificationRow(notification: notification)
                                            }
                                            .buttonStyle(PlainButtonStyle())
                                            .padding(.horizontal)
                                        }
                                    }
                                }
                            }
                            .padding(.bottom)
                        }
                    }
                    .appBackground()
                    .toolbar(.hidden, for: .navigationBar)
                    .sheet(isPresented: $showingSettings) {
                        SettingsView(viewModel: viewModel)
                    }
                    .onAppear {
                        Task {
                            await notificationsViewModel.markAsRead()
                        }
                    }
                    .refreshable {
                        await viewModel.fetchDashboardData(force: true)
                        await notificationsViewModel.fetchNotifications()
                    }
                    .onAppear {
                        // Fire-and-forget fetch if data is empty (non-blocking)
                        if viewModel.userInfo == nil {
                            Task.detached(priority: .userInitiated) {
                                await viewModel.fetchDashboardData()
                                await notificationsViewModel.fetchNotifications()
                            }
                        }
                    }
        }
    }
        
        // MARK: - Friend Balance Row
        struct FriendBalanceRow: View {
            let friend: UserInfo
            let balance: Double // + means they owe me, - means I owe them
            
            var body: some View {
                HStack(spacing: 12) {
                    AvatarView(user: friend, size: 40)
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text(friend.fullName)
                            .fontWeight(.medium)
                        
                        if balance == 0 {
                            Text("Settled up")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        } else if balance > 0 {
                            Text("owes you \(String(format: "$%.2f", balance))")
                                .font(.caption)
                                .foregroundColor(.green)
                        } else {
                            Text("you owe \(String(format: "$%.2f", abs(balance)))")
                                .font(.caption)
                                .foregroundColor(.red)
                        }
                    }
                    
                    Spacer()
                    
                    if balance != 0 {
                        Text(String(format: "$%.2f", abs(balance)))
                            .fontWeight(.bold)
                            .foregroundColor(balance > 0 ? .green : .red)
                    }
                }
                .padding(12)
                .background(Color(uiColor: .secondarySystemGroupedBackground))
                .cornerRadius(12)
            }
        }
        

        
        #Preview {
            ProfileView()
                .environmentObject(AuthViewModel())
        }
    }


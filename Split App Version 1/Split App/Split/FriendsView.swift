//
//  FriendsView.swift
//  Split
//
//  Friends management view with search, requests, and friend list
//

import SwiftUI

struct FriendsView: View {
    @StateObject private var viewModel = FriendsViewModel()
    @State private var showingMenu: UUID?
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Custom Header
                    Text("Friends")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 16)
                    // Search Card
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Search Profiles")
                            .font(.headline)
                        
                        HStack(spacing: 12) {
                            HStack {
                                Image(systemName: "magnifyingglass")
                                    .foregroundColor(.secondary)
                                
                                TextField("Email or username", text: $viewModel.searchQuery)
                                    .textFieldStyle(PlainTextFieldStyle())
                                    .autocapitalization(.none)
                                
                                if !viewModel.searchQuery.isEmpty {
                                    Button {
                                        viewModel.searchQuery = ""
                                    } label: {
                                        Image(systemName: "xmark.circle.fill")
                                            .foregroundColor(.secondary)
                                    }
                                }
                            }
                            .padding(.vertical, 10)
                            .padding(.horizontal, 12)
                            .background(Color(uiColor: .systemGray6))
                            .cornerRadius(10)
                        }
                        
                        // Search Results
                        if viewModel.isSearching {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                                .padding()
                        } else if !viewModel.searchResults.isEmpty {
                            VStack(spacing: 8) {
                                ForEach(viewModel.searchResults) { user in
                                    SearchResultRow(user: user) {
                                        Task { await viewModel.sendFriendRequest(to: user.id) }
                                    }
                                }
                            }
                            .padding(.top, 8)
                        }
                    }
                    .padding(20)
                    .background(Color(uiColor: .secondarySystemGroupedBackground))
                    .cornerRadius(16)
                    .shadow(color: .black.opacity(0.08), radius: 12, y: 4)
                    
                    // Pending Requests
                    if !viewModel.pendingRequests.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Pending Requests")
                                .font(.headline)
                            
                            ForEach(viewModel.pendingRequests, id: \.sender.id) { item in
                                FriendRequestRow(
                                    sender: item.sender,
                                    onAccept: {
                                        Task { await viewModel.respondToRequest(requesterId: item.sender.id, accept: true) }
                                    },
                                    onDecline: {
                                        Task { await viewModel.respondToRequest(requesterId: item.sender.id, accept: false) }
                                    }
                                )
                            }
                        }
                        .padding(20)
                        .background(Color(uiColor: .secondarySystemGroupedBackground))
                        .cornerRadius(16)
                        .shadow(color: .black.opacity(0.08), radius: 12, y: 4)
                    }
                    
                    // Friends List
                    VStack(alignment: .leading, spacing: 12) {
                        Text("My Friends")
                            .font(.headline)
                        
                        if viewModel.isLoading {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                                .padding()
                        } else if viewModel.friends.isEmpty {
                            Text("No friends yet")
                                .foregroundColor(.secondary)
                                .frame(maxWidth: .infinity)
                                .padding()
                        } else {
                            ForEach(viewModel.friends) { item in
                                NavigationLink(destination: FriendProfileView(friend: item.friend)) {
                                    FriendRow(
                                        friend: item.friend,
                                        balance: item.balance,
                                        showingMenu: $showingMenu,
                                        onRemove: {
                                            Task { await viewModel.removeFriend(friendId: item.friend.id) }
                                        },
                                        onBlock: {
                                            Task { await viewModel.blockFriend(friendId: item.friend.id) }
                                        }
                                    )
                                }
                                .buttonStyle(PlainButtonStyle()) // Keep row styling
                            }
                        }
                    }
                }
                .padding(.horizontal)
                .padding(.bottom)
            }
            .scrollDismissesKeyboard(.interactively)
            .appBackground()
            .toolbar(.hidden, for: .navigationBar)
            .refreshable {
                await viewModel.refreshData()
            }
            .onAppear {
                // Fire-and-forget fetch if data is empty (non-blocking)
                if viewModel.friends.isEmpty && viewModel.pendingRequests.isEmpty {
                    Task.detached(priority: .userInitiated) {
                        await viewModel.refreshData()
                    }
                }
            }
            .alert("Error", isPresented: .init(
                get: { viewModel.errorMessage != nil },
                set: { if !$0 { viewModel.errorMessage = nil } }
            )) {
                Button("OK") { viewModel.errorMessage = nil }
            } message: {
                Text(viewModel.errorMessage ?? "")
            }
        }
    }
}

// MARK: - Search Result Row

struct SearchResultRow: View {
    let user: UserInfo
    let onAdd: () -> Void
    
    var body: some View {
        HStack(spacing: 12) {
            AvatarView(user: user, size: 42)
            
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(user.fullName)
                        .fontWeight(.semibold)
                    
                    if let username = user.username {
                        Text("@\(username)")
                            .font(.caption)
                            .foregroundColor(.indigo)
                    }
                }
                
                if let email = user.email {
                    Text(email)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            Spacer()
            
            Button("Add Friend", action: onAdd)
                .font(.caption)
                .fontWeight(.semibold)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Color.indigo)
                .foregroundColor(.white)
                .cornerRadius(20)
        }
        .padding(.vertical, 8)
    }
}

// MARK: - Friend Request Row

// MARK: - Friend Request Row

struct FriendRequestRow: View {
    let sender: UserInfo
    let onAccept: () -> Void
    let onDecline: () -> Void
    
    @State private var offset: CGFloat = 0
    @State private var isDragging = false
    
    var body: some View {
        ZStack {
            // Background Action Layer
            HStack {
                // Leading (Accept/Green)
                if offset > 0 {
                    ZStack(alignment: .leading) {
                        Color.green
                        Image(systemName: "checkmark")
                            .foregroundColor(.white)
                            .font(.title3)
                            .fontWeight(.bold)
                            .padding(.leading, 24)
                    }
                }
                
                // Trailing (Decline/Red)
                if offset < 0 {
                    ZStack(alignment: .trailing) {
                        Color.red
                        Image(systemName: "xmark")
                            .foregroundColor(.white)
                            .font(.title3)
                            .fontWeight(.bold)
                            .padding(.trailing, 24)
                    }
                }
            }
            .cornerRadius(12)
            
            // Foreground Content
            HStack(spacing: 12) {
                AvatarView(user: sender, size: 42)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(sender.fullName)
                        .fontWeight(.semibold)
                    
                    if let email = sender.email {
                        Text(email)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    // Helper text if user hasn't swiped
                    if offset == 0 && !isDragging {
                        Text("Swipe right to accept, left to decline")
                            .font(.caption2)
                            .foregroundColor(.secondary.opacity(0.6))
                            .padding(.top, 2)
                    }
                }
                
                Spacer()
                
                // Visual cue (chevron) could be helpful, or just clean
                Image(systemName: "chevron.left.chevron.right")
                    .font(.caption)
                    .foregroundColor(.secondary.opacity(0.3))
            }
            .padding(12)
            .background(Color(uiColor: .tertiarySystemGroupedBackground))
            .cornerRadius(12)
            .offset(x: offset)
            .gesture(
                DragGesture(minimumDistance: 30, coordinateSpace: .local)
                    .onChanged { value in
                        isDragging = true
                        // Resistance logic or raw translation
                        offset = value.translation.width
                    }
                    .onEnded { value in
                        isDragging = false
                        withAnimation(.spring()) {
                            if offset > 100 {
                                // Accept
                                onAccept()
                                offset = 1000 // Swipe away visual
                            } else if offset < -100 {
                                // Decline
                                onDecline()
                                offset = -1000 // Swipe away visual
                            } else {
                                // Reset
                                offset = 0
                            }
                        }
                    }
            )
        }
    }
}

// MARK: - Friend Row

struct FriendRow: View {
    let friend: UserInfo
    let balance: Double
    @Binding var showingMenu: UUID?
    let onRemove: () -> Void
    let onBlock: () -> Void
    
    var body: some View {
        HStack(spacing: 12) {
            AvatarView(user: friend, size: 42)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(friend.fullName)
                    .fontWeight(.semibold)
                
                // Balance Text
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
            
            // Balance Amount on Right
            if balance != 0 {
                Text(String(format: "$%.2f", abs(balance)))
                    .fontWeight(.bold)
                    .foregroundColor(balance > 0 ? .green : .red)
                    .padding(.trailing, 8)
            }
            
            Menu {
                Button("Remove friend", role: .destructive, action: onRemove)
                Button("Block friend", role: .destructive, action: onBlock)
            } label: {
                Image(systemName: "ellipsis")
                    .rotationEffect(.degrees(90))
                    .foregroundColor(.secondary)
                    .frame(width: 36, height: 36)
                    .background(Color.gray.opacity(0.1))
                    .cornerRadius(8)
            }
        }
        .padding(16)
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 8, y: 2)
    }
}

#Preview {
    FriendsView()
}

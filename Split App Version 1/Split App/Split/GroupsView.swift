//
//  GroupsView.swift
//  Split
//
//  Groups list view with create and invites
//

import SwiftUI
import Supabase
import Auth

struct GroupsView: View {
    @StateObject private var viewModel = GroupsViewModel()
    
    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottomTrailing) {
                ScrollView {
                    VStack(spacing: 16) {
                        // Custom Header
                        Text("Groups")
                            .font(.largeTitle)
                            .fontWeight(.bold)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.top, 16)
                        // Groups List
                        VStack(alignment: .leading, spacing: 12) {
                            Text("All Groups")
                                .font(.headline)
                            
                            if viewModel.isLoading {
                                ProgressView()
                                    .frame(maxWidth: .infinity)
                                    .padding()
                            } else if viewModel.groups.isEmpty {
                                Text("You have not created any groups yet")
                                    .foregroundColor(.secondary)
                                    .frame(maxWidth: .infinity)
                                    .padding()
                            } else {
                                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                                    ForEach(viewModel.groups) { groupWithInfo in
                                        if let info = groupWithInfo.groupInfo {
                                            NavigationLink(destination: GroupDetailView(group: info)) {
                                                GroupCard(
                                                    group: info,
                                                    onSettings: {
                                                        viewModel.startEditingGroup(info)
                                                    }
                                                )
                                            }
                                            .buttonStyle(.plain)
                                        }
                                    }
                                }
                            }
                        }
                        
                        // Group Invites
                        if !viewModel.groupInvites.isEmpty {
                            VStack(alignment: .leading, spacing: 12) {
                                Text("Pending Group Invites")
                                    .font(.headline)
                                
                                ForEach(viewModel.groupInvites) { invite in
                                    if let info = invite.groupInfo {
                                        GroupInviteRow(
                                            group: info,
                                            onAccept: {
                                                Task { await viewModel.respondToInvite(groupId: invite.groupId, accept: true) }
                                            },
                                            onDecline: {
                                                Task { await viewModel.respondToInvite(groupId: invite.groupId, accept: false) }
                                            }
                                        )
                                    }
                                }
                            }
                            .padding(20)
                            .background(Color(uiColor: .secondarySystemGroupedBackground))
                            .cornerRadius(16)
                            .shadow(color: .black.opacity(0.08), radius: 12, y: 4)
                        }
                    }
                    .padding(.horizontal)
                    .padding(.bottom, 80) // Space for FAB
                }
                .appBackground()
                
                // FAB
                Button(action: { viewModel.showingCreateSheet = true }) {
                    Image(systemName: "plus")
                        .font(.title2)
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                        .frame(width: 56, height: 56)
                        .background(Color.indigo)
                        .clipShape(Circle())
                        .shadow(color: .black.opacity(0.3), radius: 6, x: 0, y: 3)
                }
                .padding(.trailing, 24)
                .padding(.bottom, 24)
            }
            .toolbar(.hidden, for: .navigationBar)
            .refreshable {
                await viewModel.refreshData()
            }
            .onAppear {
                // Fire-and-forget fetch if data is empty (non-blocking)
                if viewModel.groups.isEmpty && viewModel.groupInvites.isEmpty {
                    Task.detached(priority: .userInitiated) {
                        await viewModel.refreshData()
                    }
                }
            }
            .sheet(isPresented: $viewModel.showingCreateSheet) {
                CreateGroupSheet(viewModel: viewModel)
            }
            .sheet(isPresented: $viewModel.showingEditSheet) {
                EditGroupSheet(viewModel: viewModel)
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
    
    
    // MARK: - Group Card
    
    struct GroupCard: View {
        let group: GroupInfo
        let onSettings: () -> Void
        
        var body: some View {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Spacer()
                    
                    Button(action: onSettings) {
                        Image(systemName: "gearshape.fill")
                            .foregroundColor(.secondary)
                    }
                }
                
                Text(group.title)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .lineLimit(2)
                
                Text(group.description ?? "No description")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
                    .truncationMode(.tail)
                
                Spacer()
                
                Text("Open group →")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.indigo)
            }
            .padding(16)
            .frame(maxWidth: .infinity, minHeight: 140, alignment: .topLeading)
            .background(Color(uiColor: .secondarySystemGroupedBackground))
            .cornerRadius(14)
            .shadow(color: .black.opacity(0.05), radius: 8, y: 2)
        }
    }
    
    // MARK: - Group Invite Row
    
    struct GroupInviteRow: View {
        let group: GroupInfo
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
                .cornerRadius(14)
                
                // Foreground Content
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(group.title)
                            .fontWeight(.semibold)
                        
                        Text(group.description ?? "No description")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .lineLimit(2)
                            .truncationMode(.tail)
                        
                        // Helper text
                        if offset == 0 && !isDragging {
                            Text("Swipe right to join, left to decline")
                                .font(.caption2)
                                .foregroundColor(.secondary.opacity(0.6))
                                .padding(.top, 2)
                        }
                    }
                    
                    Spacer()
                    
                    Image(systemName: "chevron.left.chevron.right")
                        .font(.caption)
                        .foregroundColor(.secondary.opacity(0.3))
                }
                .padding(16)
                .background(Color(uiColor: .tertiarySystemGroupedBackground))
                .cornerRadius(14)
                .offset(x: offset)
                .gesture(
                    DragGesture(minimumDistance: 30, coordinateSpace: .local)
                        .onChanged { value in
                            isDragging = true
                            offset = value.translation.width
                        }
                        .onEnded { value in
                            isDragging = false
                            withAnimation(.spring()) {
                                if offset > 100 {
                                    // Accept
                                    onAccept()
                                    offset = 1000
                                } else if offset < -100 {
                                    // Decline
                                    onDecline()
                                    offset = -1000
                                } else {
                                    offset = 0
                                }
                            }
                        }
                )
            }
        }
    }
        
        // MARK: - Create Group Sheet
        
        struct CreateGroupSheet: View {
            @ObservedObject var viewModel: GroupsViewModel
            @Environment(\.dismiss) private var dismiss
            
            var body: some View {
                NavigationStack {
                    Form {
                        Section {
                            TextField("Group title", text: $viewModel.newGroupTitle)
                            TextField("Description (optional)", text: $viewModel.newGroupDescription, axis: .vertical)
                                .lineLimit(3...6)
                        }
                    }
                    .scrollDismissesKeyboard(.interactively)
                    .navigationTitle("Create Group")
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Cancel") { dismiss() }
                        }
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Create") {
                                Task { await viewModel.createGroup() }
                            }
                            .disabled(viewModel.newGroupTitle.trimmingCharacters(in: .whitespaces).isEmpty || viewModel.isLoading)
                        }
                    }
                }
            }
        }
        
        // MARK: - Edit Group Sheet
        
        struct EditGroupSheet: View {
            @ObservedObject var viewModel: GroupsViewModel
            @Environment(\.dismiss) private var dismiss
            @State private var showingDeleteAlert = false
            
            var body: some View {
                NavigationStack {
                    Form {
                        Section {
                            TextField("Group title", text: $viewModel.editGroupTitle)
                            TextField("Description (optional)", text: $viewModel.editGroupDescription, axis: .vertical)
                                .lineLimit(3...6)
                        }
                        
                        if let group = viewModel.editingGroup,
                           let ownerId = group.ownerId,
                           ownerId == SupabaseManager.shared.auth.currentSession?.user.id {
                            Section {
                                Button("Delete Group", role: .destructive) {
                                    showingDeleteAlert = true
                                }
                            }
                        }
                    }
                    .scrollDismissesKeyboard(.interactively)
                    .navigationTitle("Edit Group")
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Cancel") { dismiss() }
                        }
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Save") {
                                Task { await viewModel.updateGroup() }
                            }
                            .disabled(viewModel.editGroupTitle.trimmingCharacters(in: .whitespaces).isEmpty || viewModel.isLoading)
                        }
                    }
                    .alert("Delete Group", isPresented: $showingDeleteAlert) {
                        Button("Cancel", role: .cancel) { }
                        Button("Delete", role: .destructive) {
                            if let group = viewModel.editingGroup {
                                Task { await viewModel.deleteGroup(groupId: group.id) }
                            }
                        }
                    } message: {
                        Text("This will permanently delete the group and all its data. This action cannot be undone.")
                    }
                }
            }
        }
        
        
    }


#Preview {
    GroupsView()
}


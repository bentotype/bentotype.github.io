//
//  GroupDetailView.swift
//  Split
//
//  Detailed group view with members, expenses, and activity
//

import SwiftUI

struct GroupDetailView: View {
    @StateObject private var viewModel: GroupDetailViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var isEditing = false
    @State private var selectedExpense: ExpenseInfo?
    
    init(group: GroupInfo) {
        _viewModel = StateObject(wrappedValue: GroupDetailViewModel(group: group))
    }
    
    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Group Info Card
                VStack(alignment: .leading, spacing: 8) {

                    
                    Text(viewModel.group.description ?? "No description provided")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(20)
                .background(Color(uiColor: .secondarySystemGroupedBackground))
                .cornerRadius(16)
                .shadow(color: .black.opacity(0.08), radius: 12, y: 4)
                
                // Members Card
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text("Members")
                            .font(.headline)
                        
                        Spacer()
                        
                        Button(action: {
                            Task { await viewModel.fetchAvailableFriends() }
                            viewModel.showingInviteSheet = true
                        }) {
                            Image(systemName: "plus")
                                .fontWeight(.semibold)
                                .frame(width: 32, height: 32)
                                .background(Color.indigo.opacity(0.15))
                                .foregroundColor(.indigo)
                                .clipShape(Circle())
                        }
                    }
                    
                    if viewModel.isLoading {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                            .padding()
                    } else {
                        ForEach(viewModel.members) { member in
                            NavigationLink(destination: FriendProfileView(friend: member)) {
                                MemberRow(
                                    member: member,
                                    isOwner: member.id == viewModel.group.ownerId,
                                    canRemove: viewModel.isOwner && member.id != viewModel.group.ownerId,
                                    onRemove: {
                                        Task { await viewModel.removeMember(userId: member.id) }
                                    }
                                )
                            }
                            .buttonStyle(PlainButtonStyle())
                        }
                    }
                }
                .padding(20)
                .background(Color(uiColor: .secondarySystemGroupedBackground))
                .cornerRadius(16)
                .shadow(color: .black.opacity(0.08), radius: 12, y: 4)
                
                // Activity Card
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text("Activity")
                            .font(.headline)
                        
                        Spacer()
                        
                        Button(action: { viewModel.showingScannerSheet = true }) {
                            Label("Expense", systemImage: "plus")
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(Color.indigo)
                                .foregroundColor(.white)
                                .cornerRadius(16)
                        }
                    }
                    
                    // Vertical layout: Pending then Recent
                    VStack(spacing: 24) {
                        // Pending for you
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Pending for you")
                                .font(.subheadline)
                                .fontWeight(.semibold)
                            
                            if viewModel.pendingExpenses.isEmpty {
                                Text("No pending approvals")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                    .padding(.vertical, 8)
                            } else {
                                ForEach(viewModel.pendingExpenses) { expense in
                                    InteractiveExpensePill(
                                        expense: expense,
                                        onApprove: {
                                            Task { await viewModel.approveExpense(expenseId: expense.id) }
                                        }
                                    )
                                    .contentShape(Rectangle())
                                    .onTapGesture {
                                        if let info = expense.expenseInfo {
                                            selectedExpense = info
                                        }
                                    }
                                }
                            }
                        }
                        
                        Divider()
                        
                        // Recent expenses
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Text("Recent expenses")
                                    .font(.subheadline)
                                    .fontWeight(.semibold)
                                
                                Spacer()
                                
                                if viewModel.isOwner {
                                    Button(isEditing ? "Done" : "Edit") {
                                        withAnimation { isEditing.toggle() }
                                    }
                                    .font(.caption)
                                    .fontWeight(.bold)
                                    .foregroundColor(isEditing ? .white : .red)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 4)
                                    .background(isEditing ? Color.red : Color.red.opacity(0.1))
                                    .cornerRadius(8)
                                }
                            }
                            
                            if viewModel.expenseActivity.isEmpty {
                                Text("No expenses yet")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                    .padding(.vertical, 8)
                            } else {
                                ForEach(viewModel.expenseActivity.prefix(10)) { expense in
                                    HStack {
                                        if isEditing {
                                            Button(action: {
                                                Task { await viewModel.deleteExpense(expenseId: expense.id) }
                                            }) {
                                                Image(systemName: "minus.circle.fill")
                                                    .foregroundColor(.red)
                                                    .font(.title3)
                                            }
                                            .transition(.move(edge: .leading))
                                        }
                                        
                                        ExpenseActivityRow(
                                            expense: expense,
                                            payerName: viewModel.getMemberName(for: expense.payerId)
                                        )
                                        .contentShape(Rectangle()) // Make entire row tappable
                                        .onTapGesture {
                                            if !isEditing {
                                                selectedExpense = expense
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                .padding(20)
                .background(Color(uiColor: .secondarySystemGroupedBackground))
                .cornerRadius(16)
                .shadow(color: .black.opacity(0.08), radius: 12, y: 4)
            }
            .padding()
        }
        .appBackground()
        .navigationTitle(viewModel.group.title)

        .refreshable {
            await viewModel.fetchAll()
        }
        .task {
            await viewModel.fetchAll()
        }
        .sheet(isPresented: $viewModel.showingInviteSheet) {
            InviteFriendsSheet(viewModel: viewModel)
        }
        .sheet(isPresented: $viewModel.showingScannerSheet) {
            ReceiptScannerView(
                members: viewModel.members,
                onComplete: { amount, description, splits in
                    viewModel.scannedAmount = amount
                    viewModel.scannedExplanation = description
                    viewModel.scannedSplits = splits
                    viewModel.showingCreateExpenseSheet = true
                },
                onManualEntry: {
                    viewModel.scannedAmount = nil
                    viewModel.scannedExplanation = nil
                    viewModel.scannedSplits = nil
                    // Small delay to ensure sheet dismissal logic settles or swap sheets relying on state
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                        viewModel.showingCreateExpenseSheet = true
                    }
                }
            )
        }
        .sheet(isPresented: $viewModel.showingCreateExpenseSheet) {
            CreateExpenseView(
                groupId: viewModel.group.id,
                members: viewModel.members,
                prefilledAmount: viewModel.scannedAmount,
                prefilledExplanation: viewModel.scannedExplanation,
                prefilledSplits: viewModel.scannedSplits,
                onComplete: {
                    Task { await viewModel.fetchAll() }
                    viewModel.scannedAmount = nil
                    viewModel.scannedExplanation = nil
                    viewModel.scannedSplits = nil
                }
            )
        }
        .sheet(item: $selectedExpense) { expense in
            ExpenseDetailSheet(expense: expense)
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

// MARK: - Member Row

struct MemberRow: View {
    let member: UserInfo
    let isOwner: Bool
    let canRemove: Bool
    let onRemove: () -> Void
    
    var body: some View {
        HStack(spacing: 12) {
            AvatarView(user: member, size: 36)
            
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(member.fullName)
                        .fontWeight(.semibold)
                        .foregroundColor(isOwner ? .green : .primary)
                    
                    if let username = member.username {
                        Text("@\(username)")
                            .font(.caption)
                            .foregroundColor(.indigo)
                    }
                    
                    if isOwner {
                        Text("Owner")
                            .font(.caption2)
                            .fontWeight(.semibold)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.green.opacity(0.15))
                            .foregroundColor(.green)
                            .cornerRadius(10)
                    }
                }
                
                if let email = member.email {
                    Text(email)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            Spacer()
            
            if canRemove {
                Button(action: onRemove) {
                    Image(systemName: "minus")
                        .fontWeight(.bold)
                        .foregroundColor(.red)
                        .frame(width: 28, height: 28)
                        .background(Color.red.opacity(0.1))
                        .clipShape(Circle())
                }
            }
        }
        .padding(.vertical, 8)
    }
}

// MARK: - Expense Pill

struct ExpensePill: View {
    let title: String
    let dueDate: Date?
    let amount: Double
    
    var formattedDueDate: String {
        guard let date = dueDate else { return "No due date" }
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        return "Due \(formatter.string(from: date))"
    }
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.caption)
                    .fontWeight(.semibold)
                
                Text(formattedDueDate)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Text(String(format: "$%.2f", amount))
                .font(.caption)
                .fontWeight(.bold)
                .foregroundColor(.indigo)
        }
        .padding(10)
        .background(Color.gray.opacity(0.05))
        .cornerRadius(10)
        .onTapGesture {
            // Optional: Show details
        }
    }
}

// Separate struct for interactive pill or just add button
// Let's modify ExpensePill to support approval action if needed
struct InteractiveExpensePill: View {
    let expense: ExpenseWithInfo
    let onApprove: () -> Void
    
    var body: some View {
        HStack(spacing: 12) {
            // Date Box
            if let date = expense.expenseInfo?.dueDate {
                VStack(spacing: 0) {
                    Text(date.formatted(.dateTime.month()))
                        .font(.system(size: 10, weight: .bold))
                        .textCase(.uppercase)
                        .foregroundColor(.red)
                    
                    Text(date.formatted(.dateTime.day()))
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.primary)
                }
                .frame(width: 40, height: 40)
                .background(Color(uiColor: .systemGroupedBackground))
                .cornerRadius(8)
            } else {
                // Placeholder or hide? If no due date, maybe just an icon or nothing.
                // Keeping layout consistent:
                Image(systemName: "calendar")
                    .font(.system(size: 20))
                    .foregroundColor(.secondary)
                    .frame(width: 40, height: 40)
                    .background(Color(uiColor: .systemGroupedBackground))
                    .cornerRadius(8)
            }
            
            VStack(alignment: .leading, spacing: 2) {
                Text(expense.expenseInfo?.title ?? "Expense")
                    .font(.subheadline) // Slightly larger than caption
                    .fontWeight(.semibold)
                
               // Removed the small "Due date" text since it's now on the left
            }
            
            Spacer()
            
            VStack(alignment: .trailing) {
                Text(String(format: "$%.2f", Double(expense.individualAmount ?? 0) / 100.0))
                    .font(.caption)
                    .fontWeight(.bold)
                    .foregroundColor(.indigo)
                
                if expense.approval == true {
                    Text("Time to push your friends!")
                        .font(.caption2)
                        .fontWeight(.medium)
                        .foregroundColor(.secondary)
                        .padding(.top, 2)
                    
                    Text("Waiting for others")
                        .font(.caption2)
                        .fontWeight(.bold)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.yellow.opacity(0.15))
                        .foregroundColor(.orange)
                        .cornerRadius(8)
                } else {
                    Button("Approve") {
                        onApprove()
                    }
                    .font(.caption2)
                    .fontWeight(.bold)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.green)
                    .foregroundColor(.white)
                    .cornerRadius(8)
                }
            }
        }
        .padding(10)
        .background(Color(uiColor: .tertiarySystemGroupedBackground))
        .cornerRadius(10)
    }
}

// MARK: - Expense Activity Row

struct ExpenseActivityRow: View {
    let expense: ExpenseInfo
    let payerName: String
    
    var formattedDueDate: String {
        guard let date = expense.dueDate else { return "No due date" }
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        return formatter.string(from: date)
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(expense.title ?? "Expense")
                    .font(.caption)
                    .fontWeight(.semibold)
                
                Spacer()
                
                Text(expense.formattedAmount)
                    .font(.caption)
                    .fontWeight(.bold)
            }
            
            HStack(spacing: 4) {
                Text(expense.proposal == true ? "Waiting for approval" : "Approved")
                    .font(.caption2)
                    .fontWeight(.semibold)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(expense.proposal == true ? Color.red.opacity(0.15) : Color.green.opacity(0.15))
                    .foregroundColor(expense.proposal == true ? .red : .green)
                    .cornerRadius(8)
                
                Text("•")
                    .foregroundColor(.secondary)
                
                Text(payerName)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding(8)
    }
}

// MARK: - Invite Friends Sheet

struct InviteFriendsSheet: View {
    @ObservedObject var viewModel: GroupDetailViewModel
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                Text("Select friends below to add them to this group.")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .padding(.horizontal)
                
                if viewModel.availableFriends.isEmpty {
                    Text("No friends available to invite")
                        .foregroundColor(.secondary)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List(viewModel.availableFriends) { friend in
                        HStack(spacing: 12) {
                            AvatarView(user: friend, size: 40)
                            
                            VStack(alignment: .leading, spacing: 2) {
                                Text(friend.fullName)
                                    .fontWeight(.semibold)
                                
                                if let email = friend.email {
                                    Text(email)
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                            
                            Spacer()
                            
                            Button("Invite") {
                                Task { await viewModel.inviteFriend(userId: friend.id) }
                            }
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(Color.indigo)
                            .foregroundColor(.white)
                            .cornerRadius(16)
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Invite Friends")

            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

#Preview {
    NavigationStack {
        GroupDetailView(group: GroupInfo(
            id: UUID(),
            groupTitle: "Test Group",
            description: "A test group description",
            ownerId: nil
        ))
    }
}

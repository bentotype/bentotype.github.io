//
//  FriendProfileView.swift
//  Split
//
//  Shows friend details, net balance, and transaction history
//

import SwiftUI
import Auth
import Supabase

struct FriendProfileView: View {
    let friend: UserInfo
    @State private var dues: [SupabaseService.Due] = []
    @State private var isLoading = false
    @State private var netBalance: Double = 0 // + Friend owes me, - I owe friend
    @State private var selectedExpense: ExpenseInfo?
    
    // Get current user ID
    private var currentUserId: UUID? {
        SupabaseManager.shared.auth.currentSession?.user.id
    }
    
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Header: Avatar & Name
                VStack(spacing: 12) {
                    AvatarView(user: friend, size: 100)
                    
                    VStack(spacing: 4) {
                        Text(friend.fullName)
                            .font(.title2)
                            .fontWeight(.bold)
                        
                        if let username = friend.username {
                            Text("@\(username)")
                                .foregroundColor(.secondary)
                        }
                    }
                }
                .padding(.top)
                
                // Net Balance Card
                VStack(spacing: 8) {
                    Text("Net Balance")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    
                    if isLoading {
                        ProgressView()
                    } else if netBalance == 0 {
                        Text("Settled Up")
                            .font(.title)
                            .fontWeight(.bold)
                            .foregroundColor(.secondary)
                            .padding(.vertical, 8)
                        
                        Text("No outstanding balance")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            
                    } else {
                        // Logic: 
                        // If netBalance > 0: Friend owes me (Green)
                        // If netBalance < 0: I owe friend (Red)
                        
                        HStack(alignment: .firstTextBaseline, spacing: 4) {
                            Text(netBalance > 0 ? "+" : "-")
                            Text(String(format: "$%.2f", abs(netBalance)))
                        }
                        .font(.system(size: 36, weight: .bold))
                        .foregroundColor(netBalance > 0 ? .green : .red)
                        
                        Text(netBalance > 0 ? "\(friend.firstName ?? friend.fullName) owes you" : "You owe \(friend.firstName ?? friend.fullName)")
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .foregroundColor(netBalance > 0 ? .green : .red)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(
                                (netBalance > 0 ? Color.green : Color.red)
                                    .opacity(0.1)
                            )
                            .cornerRadius(12)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(20)
                .background(Color(uiColor: .secondarySystemGroupedBackground))
                .cornerRadius(16)
                .shadow(color: .black.opacity(0.05), radius: 8, y: 2)
                .padding(.horizontal)
                
                // Transactions List
                VStack(alignment: .leading, spacing: 16) {
                    Text("History")
                        .font(.headline)
                        .padding(.horizontal)
                    
                    if dues.isEmpty && !isLoading {
                        Text("No transaction history")
                            .foregroundColor(.secondary)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding()
                    } else {
                        LazyVStack(spacing: 12) {
                            ForEach(dues) { due in
                                TransactionRow(due: due, currentUserId: currentUserId, friendName: friend.firstName ?? friend.fullName)
                                    .contentShape(Rectangle())
                                    .onTapGesture {
                                        if let expense = due.expenseInfo {
                                            selectedExpense = expense
                                        }
                                    }
                            }
                        }
                        .padding(.horizontal)
                    }
                }
            }
            .padding(.bottom)
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .navigationTitle("Profile")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await fetchDues()
        }
        .sheet(item: $selectedExpense) { expense in
            ExpenseDetailSheet(expense: expense)
        }
    }
    
    private func fetchDues() async {
        guard let myId = currentUserId else { return }
        isLoading = true
        
        do {
            let fetchedDues = try await SupabaseService.shared.fetchDues(user1: myId, user2: friend.id)
            self.dues = fetchedDues
            calculateNetBalance(myId: myId)
        } catch {
            print("Error fetching dues: \(error)")
        }
        
        isLoading = false
    }
    
    private func calculateNetBalance(myId: UUID) {
        // Logic:
        // id_1 is Payer, id_2 is Ower.
        // If I am id_1, friend owes me (+ amount)
        // If I am id_2, I owe friend (- amount)
        
        var total: Double = 0
        
        for due in dues {
            if due.id1 == myId {
                total += due.amount
            } else if due.id2 == myId {
                total -= due.amount
            }
        }
        
        self.netBalance = total
    }
}

struct TransactionRow: View {
    let due: SupabaseService.Due
    let currentUserId: UUID?
    let friendName: String
    
    var isIOwe: Bool {
        due.id2 == currentUserId
    }
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(due.expenseInfo?.title ?? "Expense")
                    .font(.body)
                    .fontWeight(.medium)
                
                Text(isIOwe ? "You owe \(friendName)" : "\(friendName) owes you")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Text(String(format: "$%.2f", due.amount))
                .fontWeight(.bold)
                .foregroundColor(isIOwe ? .red : .green)
        }
        .padding()
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .cornerRadius(12)
    }
}

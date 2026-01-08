//
//  ExpenseDetailSheet.swift
//  Split
//
//  Created by Benjamin Chen on 12/25/25.
//

import SwiftUI
import Supabase

struct ExpenseDetailSheet: View {
    let expense: ExpenseInfo
    @Environment(\.dismiss) var dismiss
    
    // For editing
    @State private var isEditing = false
    @State private var editedTitle: String = ""
    @State private var editedAmount: Double = 0.0
    @State private var editedExplanation: String = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    
    // Split details
    @State private var splits: [(user: UserInfo, amount: Int)] = []
    @State private var groupTitle: String?
    @State private var showClaimPayerAlert = false
    @State private var showDeleteAlert = false
    @EnvironmentObject var homeViewModel: HomeViewModel
    
    // Get current user ID
    private var currentUserId: UUID? {
        SupabaseManager.shared.auth.currentSession?.user.id
    }
    
    var body: some View {
        NavigationView {
            ScrollView {

                VStack(spacing: 24) {
                    // Receipt Image
                    if let imagePath = expense.receiptImage {
                        AsyncImage(url: URL(string: SupabaseManager.shared.getStorageUrl(path: imagePath))) { image in
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fit)
                                .frame(maxHeight: 300)
                                .cornerRadius(12)
                        } placeholder: {
                            ZStack {
                                Color.gray.opacity(0.1)
                                ProgressView()
                            }
                            .frame(height: 200)
                            .cornerRadius(12)
                        }
                    }
                    
                    if isEditing {
                        // Edit Mode
                        VStack(spacing: 16) {
                            TextField("Title", text: $editedTitle)
                                .textFieldStyle(RoundedBorderTextFieldStyle())
                                .font(.headline)
                            
                            TextField("Explanation", text: $editedExplanation)
                                .textFieldStyle(RoundedBorderTextFieldStyle())
                            
                            HStack {
                                Text("$")
                                TextField("Amount", value: $editedAmount, format: .number)
                                    .keyboardType(.decimalPad)
                                    .textFieldStyle(RoundedBorderTextFieldStyle())
                            }
                        }
                        .padding()
                        
                    } else {
                        // Display Mode
                        VStack(spacing: 8) {
                            Text(expense.title ?? "Expense")
                                .font(.title2)
                                .fontWeight(.bold)
                                .multilineTextAlignment(.center)
                            
                            if let groupTitle = groupTitle {
                                Text(groupTitle)
                                    .font(.subheadline)
                                    .fontWeight(.medium)
                                    .foregroundColor(.secondary)
                            }
                            
                            Text(expense.formattedAmount)
                                .font(.system(size: 36, weight: .heavy, design: .rounded))
                                .foregroundColor(.indigo)
                            
                            if let explanation = expense.explanation, !explanation.isEmpty {
                                Text(explanation)
                                    .font(.body)
                                    .foregroundColor(.secondary)
                                    .multilineTextAlignment(.center)
                                    .padding(.top, 4)
                            }
                        }
                    }
                    
                    // Status
                    HStack {
                        StatusPill(text: expense.proposal == true ? "Pending" : "Finalized", color: expense.proposal == true ? .orange : .green)
                        
                        if let dueDate = expense.dueDate {
                            StatusPill(text: "Due \(formatDate(dueDate))", color: .blue)
                        }
                    }
                    

                    
                    Divider()
                    
                    // Split Breakdown
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Split Breakdown")
                            .font(.headline)
                            .foregroundColor(.secondary)
                        
                        if splits.isEmpty {
                            ProgressView()
                                .frame(maxWidth: .infinity, alignment: .center)
                        } else {
                            ForEach(splits, id: \.user.id) { split in
                                HStack {
                                    Text(split.user.fullName)
                                        .font(.body)
                                    
                                    if split.user.id == expense.payerId {
                                        Text("Payer")
                                            .font(.caption2)
                                            .fontWeight(.bold)
                                            .padding(.horizontal, 6)
                                            .padding(.vertical, 2)
                                            .background(Color.indigo.opacity(0.1))
                                            .foregroundColor(.indigo)
                                            .cornerRadius(6)
                                    }
                                    
                                    Spacer()
                                    Text(String(format: "$%.2f", Double(split.amount) / 100.0))
                                        .fontWeight(.semibold)
                                }
                                .padding(.vertical, 4)
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    
                    Spacer()
                    
                    VStack(spacing: 12) {
                        // Claim Payer Button (if finalized and no payer)
                        if expense.proposal == false && expense.payerId == nil {
                            Button(action: {
                                showClaimPayerAlert = true
                            }) {
                                Text("I paid for this")
                                    .fontWeight(.bold)
                                    .frame(maxWidth: .infinity)
                                    .padding()
                                    .background(Color.green)
                                    .foregroundColor(.white)
                                    .cornerRadius(12)
                            }
                        }
                        
                        // Delete Button (if payer)
                        if let myId = currentUserId, expense.payerId == myId {
                            Button(action: {
                                showDeleteAlert = true
                            }) {
                                Text("Delete Expense")
                                    .fontWeight(.medium)
                                    .foregroundColor(.red)
                                    .padding()
                            }
                        }
                        
                    }.padding()


                }
                .padding()
            }

            .task {
                await fetchSplits()
                await fetchGroupTitle()
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") {
                        dismiss()
                    }
                }
                
                if expense.proposal == true {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button(isEditing ? "Save" : "Edit") {
                            if isEditing {
                                saveChanges()
                            } else {
                                // Start editing
                                editedTitle = expense.title ?? ""
                                editedAmount = Double(expense.totalAmount ?? 0) / 100.0
                                editedExplanation = expense.explanation ?? ""
                                withAnimation { isEditing = true }
                            }
                        }
                        .fontWeight(isEditing ? .bold : .regular)
                    }
                }
            }
            .alert("Error", isPresented: .init(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )) {
                Button("OK") { errorMessage = nil }
            } message: {
                Text(errorMessage ?? "An unknown error occurred")
            }
            .alert("Confirm Payment", isPresented: $showClaimPayerAlert) {
                Button("Cancel", role: .cancel) { }
                Button("Confirm") {
                    claimPayer()
                }
            } message: {
                Text("Are you sure you want to mark yourself as the payer for this expense?")
            }
            .alert("Delete Expense", isPresented: $showDeleteAlert) {
                Button("Cancel", role: .cancel) { }
                Button("Delete", role: .destructive) {
                    deleteExpense()
                }
            } message: {
                Text("Are you sure you want to delete this expense? This action cannot be undone.")
            }
        }
    }
    
    private func deleteExpense() {
        isLoading = true
        Task {
            await homeViewModel.deleteExpense(expenseId: expense.id)
            isLoading = false
            dismiss()
        }
    }
    
    private func fetchSplits() async {
        do {
            var fetchedSplits = try await SupabaseService.shared.fetchExpenseSplits(expenseId: expense.id)
            
            // Sort: Payer first, then others alphabetically
            fetchedSplits.sort { split1, split2 in
                if split1.user.id == expense.payerId { return true }
                if split2.user.id == expense.payerId { return false }
                return split1.user.fullName < split2.user.fullName
            }
            
            self.splits = fetchedSplits
        } catch {
            print("Error fetching splits: \(error)")
        }
    }
    
    private func fetchGroupTitle() async {
        guard let groupId = expense.groupId else { return }
        do {
            struct GroupTitle: Decodable {
                let groupTitle: String
                
                enum CodingKeys: String, CodingKey {
                    case groupTitle = "group_title"
                }
            }
            
            let result: GroupTitle = try await SupabaseManager.shared.client
                .from("group_info")
                .select("group_title")
                .eq("group_id", value: groupId)
                .single()
                .execute()
                .value
            
            self.groupTitle = result.groupTitle
        } catch {
             print("Error fetching group title: \(error)")
        }
    }
    
    private func saveChanges() {
        isLoading = true
        Task {
            do {
                let amountInCents = Int(editedAmount * 100)
                try await SupabaseService.shared.updateExpenseInfo(
                    expenseId: expense.id,
                    title: editedTitle,
                    amount: amountInCents,
                    explanation: editedExplanation
                )
                
                // Success
                isLoading = false
                isEditing = false
                dismiss() // Close to refresh (easiest way)
                
            } catch {
                print("Error updating expense: \(error)")
                isLoading = false
                errorMessage = error.localizedDescription
            }
        }
    }
    
    private func claimPayer() {
        guard let currentUserId = SupabaseManager.shared.auth.currentSession?.user.id else { return }
        
        isLoading = true
        Task {
            do {
                try await SupabaseService.shared.claimExpensePayer(expenseId: expense.id, payerId: currentUserId)
                isLoading = false
                dismiss() // Refresh by closing
            } catch {
                print("Error claiming payer: \(error)")
                errorMessage = error.localizedDescription
                isLoading = false
            }
        }
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: date)
    }
}

struct StatusPill: View {
    let text: String
    let color: Color
    
    var body: some View {
        Text(text)
            .font(.caption)
            .fontWeight(.medium)
            .foregroundColor(color)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(color.opacity(0.1))
            .cornerRadius(20)
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .padding()
            .background(Color.indigo)
            .foregroundColor(.white)
            .cornerRadius(12)
            .opacity(configuration.isPressed ? 0.8 : 1.0)
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .padding()
            .background(Color(.secondarySystemBackground))
            .foregroundColor(.primary)
            .cornerRadius(12)
            .opacity(configuration.isPressed ? 0.8 : 1.0)
    }
}

//
//  CreateExpenseViewModel.swift
//  Split
//

import Foundation
import SwiftUI
import Combine
import Supabase
import Auth

@MainActor
class CreateExpenseViewModel: ObservableObject {
    
    @Published var title = ""
    @Published var totalAmount = ""
    @Published var payerId: UUID?
    @Published var dueDate = Date()
    @Published var hasDueDate = false
    @Published var explanation = ""
    @Published var splits: [ExpenseSplit] = []
    @Published var recurrence: RecurrenceFrequency = .none
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    // Edit mode
    var expenseId: UUID?
    var isEditing: Bool { expenseId != nil }
    
    let groupId: UUID
    let members: [UserInfo]
    
    private let service = SupabaseService.shared
    
    init(groupId: UUID, members: [UserInfo], prefilledSplits: [UUID: Double]? = nil, expenseToEdit: ExpenseInfo? = nil) {
        self.groupId = groupId
        self.members = members
        
        if let expense = expenseToEdit {
            self.expenseId = expense.id
            self.title = expense.title ?? ""
            self.explanation = expense.explanation ?? ""
            if let cents = expense.totalAmount {
                self.totalAmount = String(format: "%.2f", Double(cents) / 100.0)
            }
            self.payerId = expense.payerId
            if let date = expense.dueDate {
                self.dueDate = date
                self.hasDueDate = true
            }
            if let period = expense.period {
                self.recurrence = RecurrenceFrequency(rawValue: period) ?? .none
            }
             // Splits must be loaded asynchronously or passed in. 
             // Ideally the view controller fetches splits before init, or we fetch here.
             // We'll add a loadSplits method.
        } else if let prefilledSplits = prefilledSplits {
            // Case 1: Prefilled Splits provided (from Receipt Scanner)
            let total = prefilledSplits.values.reduce(0, +)
            self.totalAmount = String(format: "%.2f", total)
            
            self.splits = members.map { member in
                let amount = prefilledSplits[member.id] ?? 0
                let percentage = total > 0 ? (amount / total) * 100 : 0
                return ExpenseSplit(userId: member.id, userInfo: member, percentage: percentage, amount: amount)
            }
        } else {
            // Case 2: Default Even Split
            let evenPercentage = members.isEmpty ? 0 : 100.0 / Double(members.count)
            self.splits = members.map { member in
                ExpenseSplit(userId: member.id, userInfo: member, percentage: evenPercentage, amount: 0)
            }
        }
    }
    
    func loadSplits() async {
        guard let expenseId = expenseId else { return }
        isLoading = true
        do {
            let fetchedSplits = try await service.fetchExpenseSplits(expenseId: expenseId)
            let total = Double(totalAmount) ?? 0
            
            // Map fetched splits to UI model
            var newSplits: [ExpenseSplit] = []
            
            // Create map of existing splits
            let splitMap = Dictionary(uniqueKeysWithValues: fetchedSplits.map { ($0.user.id, $0.amount) })
            
            for member in members {
                let amountCents = splitMap[member.id] ?? 0
                let amount = Double(amountCents) / 100.0
                let percentage = total > 0 ? (amount / total) * 100 : 0 // Approximate
                
                newSplits.append(ExpenseSplit(
                    userId: member.id, 
                    userInfo: member, 
                    percentage: percentage, 
                    amount: amount
                ))
            }
            self.splits = newSplits
            
            // Re-normalize percentages if needed or trust the amounts
            // Recalculating amounts based on total ensures consistency
            if total > 0 {
                recalculateAmounts() 
            }
            
        } catch {
            print("Failed to load splits: \(error)")
        }
        isLoading = false
    }
    
    var totalAmountCents: Int {
        let dollars = Double(totalAmount) ?? 0
        return Int(dollars * 100)
    }
    
    var totalFromSplits: Double {
        splits.reduce(0) { $0 + $1.amount }
    }
    
    var formattedTotalFromSplits: String {
        String(format: "$%.2f", totalFromSplits)
    }
    
    var splitMatchesTotal: Bool {
        abs(totalFromSplits - (Double(totalAmount) ?? 0)) < 0.01
    }
    
    var splitStatus: String {
        let total = Double(totalAmount) ?? 0
        if total == 0 {
            return "Enter a total amount to split"
        }
        let diff = total - totalFromSplits
        if abs(diff) < 0.01 {
            return "Split matches total ✓"
        } else if diff > 0 {
            return String(format: "$%.2f remaining to allocate", diff)
        } else {
            return String(format: "$%.2f over allocated", abs(diff))
        }
    }
    
    func splitEvenly() {
        guard !splits.isEmpty else { return }
        let evenPercentage = 100.0 / Double(splits.count)
        for i in 0..<splits.count {
            splits[i].percentage = evenPercentage
        }
        recalculateAmounts()
    }
    
    func updatePercentage(for userId: UUID, to percentage: Double) {
        guard let index = splits.firstIndex(where: { $0.userId == userId }) else { return }
        splits[index].percentage = min(100, max(0, percentage))
        recalculateAmounts()
    }
    
    func recalculateAmounts() {
        let total = Double(totalAmount) ?? 0
        let totalPercentage = splits.reduce(0) { $0 + $1.percentage }
        
        for i in 0..<splits.count {
            if totalPercentage > 0 {
                splits[i].amount = (splits[i].percentage / totalPercentage) * total
            } else {
                splits[i].amount = 0
            }
        }
    }
    
    func createExpense() async -> Bool {
        // Validation
        guard !title.trimmingCharacters(in: .whitespaces).isEmpty else {
            errorMessage = "Please enter a title"
            return false
        }
        
        guard totalAmountCents > 0 else {
            errorMessage = "Please enter a valid amount"
            return false
        }
        
        guard splitMatchesTotal else {
            errorMessage = "Split amounts must match the total"
            return false
        }
        
        isLoading = true
        errorMessage = nil
        
        do {
            let splitData = splits.map { split -> (userId: UUID, amount: Int) in
                (userId: split.userId, amount: Int(split.amount * 100))
            }
            
            if let expenseId = expenseId {
                try await service.updateExpense(
                    expenseId: expenseId,
                    title: title.trimmingCharacters(in: .whitespaces),
                    totalAmount: totalAmountCents,
                    payerId: payerId,
                    dueDate: hasDueDate ? dueDate : nil,
                    period: recurrence == .none ? nil : recurrence.rawValue,
                    explanation: explanation.isEmpty ? nil : explanation,
                    splits: splitData
                )
            } else {
                try await service.createExpense(
                    groupId: groupId,
                    title: title.trimmingCharacters(in: .whitespaces),
                    totalAmount: totalAmountCents,
                    payerId: payerId,
                    dueDate: hasDueDate ? dueDate : nil,
                    period: recurrence == .none ? nil : recurrence.rawValue,
                    explanation: explanation.isEmpty ? nil : explanation,
                    splits: splitData
                )
            }
            
            isLoading = false
            return true
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
            return false
        }
    }
}

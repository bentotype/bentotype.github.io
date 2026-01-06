//
//  SupabaseService_extensions.swift
//  Split
//
//  Extensions for SupabaseService
//

import Foundation
import Supabase

extension SupabaseService {
    
    // MARK: - Calendar Expenses (Convenience method for fetching by group)
    
    func fetchExpensesForGroup(groupId: UUID) async throws -> [ExpenseInfo] {
        let response: [ExpenseInfo] = try await SupabaseManager.shared.client
            .from("expense_info")
            .select("expense_id, title, explanation, total_amount, payer_id, date, due_date, group_id, receipt_image, proposal")
            .eq("group_id", value: groupId)
            .eq("proposal", value: false)
            .order("date", ascending: false)
            .execute()
            .value
        return response
    }
    
    // MARK: - Fetch expenses for a date range across user's groups
    
    func fetchExpensesForDateRange(userId: UUID, start: Date, end: Date) async throws -> [ExpenseInfo] {
        let groups = try await getUserGroups(userId: userId)
        let groupIds = groups.map { $0.groupId.uuidString }
        
        guard !groupIds.isEmpty else { return [] }
        
        let formatter = ISO8601DateFormatter()
        
        let expenses: [ExpenseInfo] = try await SupabaseManager.shared.client
            .from("expense_info")
            .select("expense_id, title, explanation, total_amount, payer_id, date, due_date, group_id, receipt_image, proposal")
            .in("group_id", values: groupIds)
            .gte("due_date", value: formatter.string(from: start))
            .lte("due_date", value: formatter.string(from: end))
            .execute()
            .value
            
        return expenses
    }
}

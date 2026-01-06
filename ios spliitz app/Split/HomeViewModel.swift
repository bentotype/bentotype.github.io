//
//  HomeViewModel.swift
//  Split
//

import SwiftUI
import Foundation
import Supabase
import Combine
import Auth

@MainActor
class HomeViewModel: ObservableObject {
    @Published var groups: [GroupWithInfo] = []
    @Published var monthlyTotal: Double = 0
    @Published var pendingProposals: [ExpenseWithInfo] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    @Published var currentMonth: Date = Date()
    @Published var calendarEvents: [ExpenseInfo] = []
    @Published var selectedDate: Date? = nil // Nil means show upcoming
    
    
    private let service = SupabaseService.shared
    
    init() {
        // Populate from cache immediately
        let cache = AppDataManager.shared
        self.monthlyTotal = cache.monthlyTotal
        self.groups = cache.groups
    }
    
    @Published var upcomingEvents: [ExpenseInfo] = []
    
    // ...
    
    func fetchAll() async {
        await fetchMonthlyTotal()
        await fetchPendingProposals()
        await fetchCalendarEvents()
        await fetchUpcomingEvents()
    }
    
    func fetchCalendarEvents() async {
        guard let userId = SupabaseManager.shared.auth.currentSession?.user.id else { return }
        
        let calendar = Calendar.current
        guard let monthInterval = calendar.dateInterval(of: .month, for: currentMonth) else { return }
        
        let monthStart = monthInterval.start
        let weekday = calendar.component(.weekday, from: monthStart)
        // Start of grid (Sunday)
        let gridStartup = calendar.date(byAdding: .day, value: -(weekday - 1), to: monthStart)!
        
        // End of grid (42 days later to cover 6 weeks)
        let gridEnd = calendar.date(byAdding: .day, value: 42, to: gridStartup)!
        
        // Pad by 1 day to handle Timezone UTC shifts
        let safeStart = calendar.date(byAdding: .day, value: -2, to: gridStartup)! // Extra buffer
        let safeEnd = calendar.date(byAdding: .day, value: 2, to: gridEnd)!
        
        do {
            // UPDATED: Now fetches Unpaid Dues instead of generic Expenses.
            // This ensures "Settled Dues don't show up".
            let dues = try await service.fetchUnpaidDues(userId: userId, start: safeStart, end: safeEnd)
            
            // Map Dues to ExpenseInfo for display (overriding amount to show debt)
            calendarEvents = dues.compactMap { due in
                var info = due.expenseInfo
                info?.totalAmount = due.amount // Show My Debt Amount
                return info
            }
            
        } catch {
            // Ignore cancellation errors
            let nsError = error as NSError
            if nsError.code == NSURLErrorCancelled { return }
            if error is CancellationError { return }
            
            print("Failed to fetch calendar events: \(error)")
        }
        
        // Schedule notifications for upcoming events (best effort)
        Task {
            for event in calendarEvents {
                if let date = event.dueDate, date > Date() {
                    NotificationManager.shared.scheduleDeadlineNotification(for: event)
                }
            }
        }
    }
    
    func deleteExpense(expenseId: UUID) async {
        do {
            try await service.deleteExpense(expenseId: expenseId)
            await fetchAll() // Refresh UI
        } catch {
            print("Failed to delete expense: \(error)")
            errorMessage = "Failed to delete expense"
        }
    }
    
    func fetchUpcomingEvents() async {
        guard let userId = SupabaseManager.shared.auth.currentSession?.user.id else { return }
        
        do {
            // Updated to fetch only Unpaid Dues for "Upcoming" section
            // And maps them to ExpenseInfo for display, but uses the Due Amount
            let dues = try await service.fetchUpcomingDues(userId: userId)
            
            self.upcomingEvents = dues.compactMap { due in
                var info = due.expenseInfo
                // OVERRIDE the totalAmount with the Due Amount so the UI shows what *I* owe
                info?.totalAmount = due.amount 
                return info
            }
            
        } catch {
            print("Failed to fetch upcoming events: \(error)")
        }
    }
    
    func changeMonth(by value: Int) {
        if let newMonth = Calendar.current.date(byAdding: .month, value: value, to: currentMonth) {
            currentMonth = newMonth
            Task {
                await fetchCalendarEvents()
            }
        }
    }
    
    func fetchMonthlyTotal() async {
        guard let userId = SupabaseManager.shared.auth.currentSession?.user.id else { return }
        
        do {
            // Updated to use new logic (My Share + My Dues)
            monthlyTotal = try await service.fetchMonthlyMySpend(userId: userId)
        } catch {
            print("Failed to fetch monthly total: \(error)")
            monthlyTotal = 0
        }
    }
    
    func fetchPendingProposals() async {
        guard let userId = SupabaseManager.shared.auth.currentSession?.user.id else { return }
        
        isLoading = true
        errorMessage = nil
        
        do {
            pendingProposals = try await service.fetchPendingProposals(userId: userId)
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    var formattedMonthlyTotal: String {
        return String(format: "$%.2f", monthlyTotal)
    }
    
    var currentMonthName: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM"
        return formatter.string(from: Date())
    }
}

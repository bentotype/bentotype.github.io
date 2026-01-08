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
    
    func fetchAll() async {
        await fetchMonthlyTotal()
        await fetchPendingProposals()
        await fetchCalendarEvents()
    }
    
    var upcomingEvents: [ExpenseInfo] {
        let today = Date()
        let calendar = Calendar.current
        guard let nextWeek = calendar.date(byAdding: .day, value: 7, to: today) else { return [] }
        
        return calendarEvents.filter {
            guard let date = $0.dueDate else { return false }
            return date >= today && date <= nextWeek
        }
        .sorted { ($0.dueDate ?? Date()) < ($1.dueDate ?? Date()) }
    }
    
    func fetchCalendarEvents() async {
        guard let userId = SupabaseManager.shared.auth.currentSession?.user.id else { return }
        
        let calendar = Calendar.current
        guard let startOfMonth = calendar.date(from: calendar.dateComponents([.year, .month], from: currentMonth)),
              let endOfMonth = calendar.date(byAdding: DateComponents(month: 1, day: -1), to: startOfMonth) else { return }
        
        // Extend range to cover grid (previous/next month spillover)
        // For simplicity, we just fetch this month's due dates for now.
        
        do {
            calendarEvents = try await service.fetchExpensesForCalendar(userId: userId, start: startOfMonth, end: endOfMonth)
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
                // Only schedule if it has a due date in the future
                if let date = event.dueDate, date > Date() {
                    NotificationManager.shared.scheduleDeadlineNotification(for: event)
                }
            }
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
            monthlyTotal = try await service.fetchMonthlyTotal(userId: userId)
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

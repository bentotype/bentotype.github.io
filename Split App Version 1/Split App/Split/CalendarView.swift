//
//  CalendarView.swift
//  Split
//
//  Created by Benjamin Chen on 12/25/25.
//

import SwiftUI

struct CalendarView: View {
    @ObservedObject var viewModel: HomeViewModel
    
    // Calendar layout
    private let columns = Array(repeating: GridItem(.flexible()), count: 7)
    private let calendar = Calendar.current
    
    private var daysInMonth: [Date] {
        guard let monthInterval = calendar.dateInterval(of: .month, for: viewModel.currentMonth) else { return [] }
        
        // Find the first Sunday to start the grid
        let monthStart = monthInterval.start
        let weekday = calendar.component(.weekday, from: monthStart)
        let firstGridDate = calendar.date(byAdding: .day, value: -(weekday - 1), to: monthStart)!
        
        // We typically show 5 or 6 weeks (35 or 42 days)
        var days: [Date] = []
        for i in 0..<42 {
            if let date = calendar.date(byAdding: .day, value: i, to: firstGridDate) {
                days.append(date)
            }
        }
        return days
    }
    
    private var isSameMonth: Bool {
        calendar.isDate(viewModel.currentMonth, equalTo: Date(), toGranularity: .month)
    }
    
    var body: some View {
        VStack(spacing: 20) {
            // Header
            HStack {
                Button(action: {
                    withAnimation {
                        viewModel.changeMonth(by: -1)
                    }
                }) {
                    Image(systemName: "chevron.left")
                        .foregroundColor(.primary)
                }
                
                Spacer()
                
                Text(monthYearString(from: viewModel.currentMonth))
                    .font(.headline)
                    .fontWeight(.bold)
                
                Spacer()
                
                Button(action: {
                    withAnimation {
                        viewModel.changeMonth(by: 1)
                    }
                }) {
                    Image(systemName: "chevron.right")
                        .foregroundColor(.primary)
                }
            }
            .padding(.horizontal)
            
            // Days Grid
            LazyVGrid(columns: columns, spacing: 6) { // Reduced vertical spacing
                // Weekday headers
                ForEach(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], id: \.self) { day in
                    Text(day)
                        .font(.caption2) // Smaller font to help width
                        .foregroundColor(.secondary)
                }
                
                // Days
                ForEach(daysInMonth, id: \.self) { date in
                    DayCell(
                        date: date,
                        isSelected: isSelected(date),
                        isInMonth: calendar.isDate(date, equalTo: viewModel.currentMonth, toGranularity: .month),
                        hasEvent: hasEvent(on: date)
                    )
                    .onTapGesture {
                        withAnimation {
                            if isSelected(date) {
                                viewModel.selectedDate = nil // Deselect
                            } else {
                                viewModel.selectedDate = date
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, 4) // Minimal padding
            
            Divider()
            
            // Selected Day or Upcoming Events
            VStack(alignment: .leading, spacing: 12) {
                if let selected = viewModel.selectedDate {
                    // Specific Date Mode
                    Text("Expenses due on \(dayString(from: selected))")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.secondary)
                        .padding(.horizontal)
                    
                    let daysEvents = expenses(for: selected)
                    
                    if daysEvents.isEmpty {
                        Text("No expenses due")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.vertical, 20)
                    } else {
                        ForEach(daysEvents) { expense in
                            ExpenseBubble(expense: expense)
                        }
                    }
                } else {
                    // Default Upcoming Mode
                    Text("Upcoming Expenses (7 Days)")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.secondary)
                        .padding(.horizontal)
                    
                    let upcoming = viewModel.upcomingEvents
                    
                    if upcoming.isEmpty {
                        Text("No upcoming expenses")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.vertical, 20)
                    } else {
                        ForEach(upcoming) { expense in
                            ExpenseBubble(expense: expense)
                        }
                    }
                }
            }
        }
        .padding(.vertical)
        .background(Color(.systemBackground))
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.05), radius: 8, x: 0, y: 4)
    }
    
    // MARK: - Helpers
    
    private func isSelected(_ date: Date) -> Bool {
        guard let selected = viewModel.selectedDate else { return false }
        return calendar.isDate(selected, inSameDayAs: date)
    }
    
    private func hasEvent(on date: Date) -> Bool {
        viewModel.calendarEvents.contains { expense in
            guard let dueDate = expense.dueDate else { return false }
            return calendar.isDate(dueDate, inSameDayAs: date)
        }
    }
    
    private func expenses(for date: Date) -> [ExpenseInfo] {
        viewModel.calendarEvents.filter { expense in
            guard let dueDate = expense.dueDate else { return false }
            return calendar.isDate(dueDate, inSameDayAs: date)
        }
    }
    
    private func monthYearString(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM yyyy"
        return formatter.string(from: date)
    }
    
    private func dayString(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }
}

struct DayCell: View {
    let date: Date
    let isSelected: Bool
    let isInMonth: Bool
    let hasEvent: Bool
    
    var body: some View {
        VStack(spacing: 4) {
            Text("\(Calendar.current.component(.day, from: date))")
                .font(.system(size: 14))
                .fontWeight(isSelected ? .bold : .regular)
                .foregroundColor(textColor)
                .frame(width: 30, height: 30)
                .background(isSelected ? Color.indigo : Color.clear)
                .clipShape(Circle())
            
            if hasEvent {
                Circle()
                    .fill(isSelected ? Color.white : Color.red)
                    .frame(width: 4, height: 4)
            } else {
                Spacer().frame(height: 4)
            }
        }
        .opacity(isInMonth ? 1 : 0.3)
    }
    
    private var textColor: Color {
        if isSelected {
            return .white
        }
        if Calendar.current.isDateInToday(date) {
            return .indigo
        }
        return .primary
    }
}

struct ExpenseBubble: View {
    let expense: ExpenseInfo
    @State private var showingDetail = false
    
    var body: some View {
        Button(action: {
            showingDetail = true
        }) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(expense.title ?? "Expense")
                        .font(.headline)
                        .foregroundColor(.primary)
                    
                    if let subtitle = expense.explanation, !subtitle.isEmpty {
                        Text(subtitle)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .lineLimit(1)
                    }
                }
                
                Spacer()
                
                Text(expense.formattedAmount)
                    .fontWeight(.bold)
                    .foregroundColor(.primary)
            }
            .padding()
            .background(Color(.secondarySystemBackground))
            .cornerRadius(12)
            .padding(.horizontal)
        }
        .sheet(isPresented: $showingDetail) {
            ExpenseDetailSheet(expense: expense)
                .presentationDetents([.medium, .large])
        }
    }
}

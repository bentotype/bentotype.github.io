//
//  AppBackground.swift
//  Split
//
//  Shared gradient background used across all main views
//

import SwiftUI

/// Pre-computed colors to avoid repeated allocation
private enum AppColors {
    static let lightTop = Color(red: 0.62, green: 0.79, blue: 1.0)
    static let lightBottom = Color(red: 0.96, green: 0.98, blue: 1.0)
    static let darkTop = Color(red: 0.1, green: 0.1, blue: 0.2)
    static let darkBottom = Color(red: 0.05, green: 0.05, blue: 0.1)
}

/// The app's standard gradient background that adapts to light/dark mode.
struct AppBackground: View {
    @Environment(\.colorScheme) private var colorScheme
    
    var body: some View {
        LinearGradient(
            colors: colorScheme == .dark 
                ? [AppColors.darkTop, AppColors.darkBottom]
                : [AppColors.lightTop, AppColors.lightBottom],
            startPoint: .top,
            endPoint: .bottom
        )
        .ignoresSafeArea()
    }
}

/// View modifier for applying the standard app background.
extension View {
    func appBackground() -> some View {
        self.background(AppBackground())
    }
}


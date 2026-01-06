//
//  AppearanceManager.swift
//  Split
//
//  Manages app-wide color scheme preference (Light/Dark/System)
//

import SwiftUI
import Combine

enum AppearanceMode: String, CaseIterable {
    case system = "System"
    case light = "Light"
    case dark = "Dark"
    
    var colorScheme: ColorScheme? {
        switch self {
        case .system: return nil
        case .light: return .light
        case .dark: return .dark
        }
    }
}

@MainActor
class AppearanceManager: ObservableObject {
    static let shared = AppearanceManager()
    
    private let key = "app_appearance_mode"
    
    @Published var currentMode: AppearanceMode {
        didSet {
            UserDefaults.standard.set(currentMode.rawValue, forKey: key)
            applyAppearance()
        }
    }
    
    private init() {
        if let stored = UserDefaults.standard.string(forKey: key),
           let mode = AppearanceMode(rawValue: stored) {
            self.currentMode = mode
        } else {
            self.currentMode = .system
        }
    }
    
    func applyAppearance() {
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene else { return }
        for window in windowScene.windows {
            window.overrideUserInterfaceStyle = uiStyle
        }
    }
    
    var uiStyle: UIUserInterfaceStyle {
        switch currentMode {
        case .system: return .unspecified
        case .light: return .light
        case .dark: return .dark
        }
    }
}

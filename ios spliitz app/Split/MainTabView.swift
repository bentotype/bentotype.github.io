//
//  MainTabView.swift
//  Split
//
//  Main navigation with bottom tabs matching website's top nav
//

import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var notificationManager: NotificationManager
    @State private var selectedTab = 0
    
    init() {
        let appearance = UITabBarAppearance()
        appearance.configureWithDefaultBackground()
        appearance.backgroundColor = UIColor.systemBackground.withAlphaComponent(0.8)
        
        // Use this appearance when scrolling behind the TabView:
        UITabBar.appearance().standardAppearance = appearance
        // Use this appearance when scrolled all the way up:
        UITabBar.appearance().scrollEdgeAppearance = appearance
    }
    
    var body: some View {
        GeometryReader { geometry in
            TabView(selection: selectionWithHaptic) {
                HomeView()
                    .tabItem {
                        Label("Home", systemImage: "house.fill")
                    }
                    .badge(notificationManager.homeBadgeCount)
                    .tag(0)
                
                FriendsView()
                    .tabItem {
                        Label("Friends", systemImage: "person.2.fill")
                    }
                    .badge(notificationManager.friendsBadgeCount)
                    .tag(1)
                
                GroupsView()
                    .tabItem {
                        Label("Groups", systemImage: "rectangle.3.group.fill")
                    }
                    .badge(notificationManager.groupsBadgeCount)
                    .tag(2)
                
                ProfileView(selectedTab: $selectedTab)
                    .tabItem {
                        Label("Profile", systemImage: "person.fill")
                    }
                    .badge(notificationManager.profileBadgeCount)
                    .tag(3)
            }
            .tint(.indigo)
            // Add simultaneous drag gesture for edge swipes so it doesn't block scrolling
            .simultaneousGesture(
                DragGesture(minimumDistance: 30)
                    .onEnded { value in
                        let translation = value.translation
                        
                        // Check for primarily horizontal movement
                        guard abs(translation.width) > abs(translation.height) + 10 else { return }
                        
                        if translation.width > 50 {
                            // Swiped Right (Previous Tab)
                            if selectedTab > 0 {
                                withAnimation { selectedTab -= 1 }
                            }
                        } else if translation.width < -50 {
                            // Swiped Left (Next Tab)
                            if selectedTab < 3 {
                                withAnimation { selectedTab += 1 }
                            }
                        }
                    }
            )
        }
    }
    
    // Binding wrapper to add haptic feedback on change
    private var selectionWithHaptic: Binding<Int> {
        Binding(
            get: { selectedTab },
            set: {
                if $0 != selectedTab {
                    let generator = UISelectionFeedbackGenerator()
                    generator.selectionChanged()
                    let tabNames = ["Home", "Friends", "Groups", "Profile"]
                    DebugLogger.shared.log("Tab changed to: \(tabNames[$0])")
                }
                selectedTab = $0
            }
        )
    }
}

#Preview {
    MainTabView()
        .environmentObject(AuthViewModel())
}

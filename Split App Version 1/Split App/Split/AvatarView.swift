//
//  AvatarView.swift
//  Split
//
//  Created by Benjamin Chen on 12/23/25.
//

import SwiftUI

struct AvatarView: View {
    let user: UserInfo
    let size: CGFloat
    
    @State private var image: UIImage?
    @State private var isLoading = false
    
    // Use the singleton cache
    private let cache = ImageCacheService.shared
    
    var body: some View {
        SwiftUI.Group {
            if let image = image {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .frame(width: size, height: size)
                    .clipShape(Circle())
            } else {
                initialsView
                    .task {
                        await loadProfilePicture()
                    }
            }
        }
    }
    
    private func loadProfilePicture() async {
        guard let path = user.profilePicture, !path.isEmpty else { return }
        
        // Use path as key (sanitize for filename)
        let cacheKey = path.replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: ":", with: "_")
        
        // 1. Check Memory/Disk Cache
        if let cachedImage = await cache.getImage(for: cacheKey) {
            await MainActor.run {
                self.image = cachedImage
            }
            return
        }
        
        // Prevent re-fetching if already loading? 
        // For simplicity in SwiftUI Views, we just proceed. caching handles optimization.
        
        isLoading = true
        
        do {
            var url: URL?
            
            // 2. Resolve URL (Cache or Fetch)
            if path.lowercased().hasPrefix("http") {
                url = URL(string: path)
            } else {
                // Check if we have a cached signed URL first
                if let cachedURL = cache.getCachedSignedURL(for: cacheKey) {
                    url = cachedURL
                } else {
                    // Fetch new signed URL
                    url = try await SupabaseService.shared.getProfilePictureURL(path: path)
                    if let fetchedURL = url {
                        cache.cacheSignedURL(fetchedURL, for: cacheKey)
                    }
                }
            }
            
            guard let validURL = url else { return }
            
            // 3. Download Image
            let (data, _) = try await URLSession.shared.data(from: validURL)
            if let uiImage = UIImage(data: data) {
                // 4. Cache and Display
                cache.saveImage(uiImage, for: cacheKey)
                await MainActor.run {
                    self.image = uiImage
                    self.isLoading = false
                }
            }
        } catch {
            // Ignore cancellation errors (e.g. view disappeared)
            let nsError = error as NSError
            if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled {
                return
            }
            
            print("Failed to load avatar: \(error)")
            isLoading = false
        }
    }
    
    private var initialsView: some View {
        Text(user.initials)
            .font(.system(size: size * 0.4, weight: .semibold))
            .foregroundColor(.indigo)
            .frame(width: size, height: size)
            .background(Color.indigo.opacity(0.15))
            .clipShape(Circle())
    }
}

//
//  ReceiptScannerView.swift
//  Split
//
//  Created by Benjamin Chen on 12/21/25.
//

import SwiftUI

import PhotosUI

struct ScannedItem: Identifiable, Equatable {
    let id = UUID()
    var name: String
    var price: Double
}

struct ReceiptScannerView: View {
    @Environment(\.dismiss) private var dismiss
    
    // Inputs
    let members: [UserInfo]
    
    // Output callback: (Total Amount, Description, [UserID: SplitAmount])
    var onComplete: (Double, String, [UUID: Double]) -> Void
    var onManualEntry: () -> Void
    
    // UI State
    @State private var selectedImage: UIImage?
    @State private var scannedItems: [ScannedItem] = []
    @State private var isScanning = false
    @State private var showingActionSheet = false
    @State private var showingCamera = false
    @State private var selectedPhotoItem: PhotosPickerItem?
    @State private var debugText: String = ""
    
    // Selection state
    @State private var selectedItemIds: Set<UUID> = []
    
    // Assignment State: ItemID -> Set of MemberIDs (Empty set = All/Split Evenly)
    @State private var assignments: [UUID: Set<UUID>] = [:]
    
    // Parsed Special Items
    @State private var taxItem: ScannedItem?
    @State private var detectedTotalItem: ScannedItem?
    
    // Computed totals
    var subtotalSelected: Double {
        scannedItems.filter { selectedItemIds.contains($0.id) }
            .reduce(0) { $0 + $1.price }
    }
    
    var calculatedTax: Double {
        // Tax Rate = Tax / (Sum of ALL non-tax items originally found)
        // OR should it be Tax / Subtotal of SELECTED items?
        // Usually Tax applies to everything. If we uncheck an item, we probably shouldn't pay tax on it?
        // Let's assume the Tax Item found on receipt is the fixed tax.
        // We want to find the RATE.
        // Rate = TaxItem.price / (Sum of all other items that generated that tax)
        // Ideally: Rate = detectedTax / (detectedTotal - detectedTax)
        
        guard let tax = taxItem, let total = detectedTotalItem else { return 0 }
        let baseAmount = total.price - tax.price
        if baseAmount <= 0 { return 0 }
        let rate = tax.price / baseAmount
        
        return subtotalSelected * rate
    }
    
    var finalTotal: Double {
        subtotalSelected + calculatedTax
    }
    
    var isTotalMatching: Bool {
        guard let detected = detectedTotalItem else { return true }
        // Compare Calculated Grand Total (of ALL items) vs Detected Total
        // This is for validation "The system should check that the 'total' equals all of the price..."
        let allItemsSum = scannedItems.reduce(0) { $0 + $1.price }
        let allTax = taxItem?.price ?? 0
        let calculatedGrandParam = allItemsSum + allTax
        
        return abs(calculatedGrandParam - detected.price) < 0.1
    }
    
    // MARK: - Assignment Helpers
    
    private func toggleItemSelection(_ id: UUID) {
        if selectedItemIds.contains(id) {
            selectedItemIds.remove(id)
        } else {
            selectedItemIds.insert(id)
        }
    }
    
    private func toggleAssignment(_ itemId: UUID, memberId: UUID) {
        var current = assignments[itemId] ?? []
        if current.contains(memberId) {
            current.remove(memberId)
        } else {
            current.insert(memberId)
        }
        assignments[itemId] = current
    }
    
    private func assignItem(_ itemId: UUID, to memberId: UUID?) {
        if let mid = memberId {
            assignments[itemId] = [mid]
        } else {
            assignments[itemId] = [] // Everyone
        }
    }
    
    private func assignmentLabel(for itemId: UUID) -> String {
        let assigned = assignments[itemId] ?? []
        if assigned.isEmpty {
            return "Everyone"
        } else if assigned.count == members.count {
            return "Everyone"
        } else if assigned.count == 1, let uid = assigned.first {
            return members.first(where: { $0.id == uid })?.fullName ?? "Member"
        } else {
            return "\(assigned.count) People"
        }
    }
    
    private func finalizeAndContinue() {
        var userSplits: [UUID: Double] = [:]
        
        // Initialize all members with 0
        for member in members {
            userSplits[member.id] = 0
        }
        
        let selectedItems = scannedItems.filter { selectedItemIds.contains($0.id) }
        
        // 1. Calculate Tax Rate from ORIGINAL valid receipt context
        var taxRate: Double = 0
        if let tax = taxItem, let total = detectedTotalItem {
            let base = total.price - tax.price
            if base > 0 {
                taxRate = tax.price / base
            }
        }
        
        for item in selectedItems {
            let assigned = assignments[item.id] ?? []
            
            // Item cost + its proportional tax
            let itemTotalCost = item.price * (1 + taxRate)
            
            if assigned.isEmpty {
                // Split among ALL members
                let share = itemTotalCost / Double(members.count)
                for member in members {
                    userSplits[member.id, default: 0] += share
                }
            } else {
                // Split among assigned members
                let share = itemTotalCost / Double(assigned.count)
                for uid in assigned {
                    userSplits[uid, default: 0] += share
                }
            }
        }
        
        // Generate Description
        var description = selectedItems
            .map { "\($0.name) ($\(String(format: "%.2f", $0.price)))" }
            .joined(separator: "\n")
        
        if let tax = taxItem {
            description += "\n\n+ \(tax.name): $\(String(format: "%.2f", calculatedTax)) (Proportional)"
        }
        
        onComplete(finalTotal, description, userSplits)
        dismiss()
    }
    
    var body: some View {
        NavigationStack {
            VStack {
                if selectedImage != nil {
                    // Results View
                    VStack {
                        if isScanning {
                            VStack {
                                ProgressView("Analyzing receipt...")
                                    .padding()
                                Text("This may take a moment")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        } else if scannedItems.isEmpty && detectedTotalItem == nil {
                            VStack(spacing: 12) {
                                Image(systemName: "doc.text.viewfinder")
                                    .font(.system(size: 48))
                                    .foregroundColor(.secondary)
                                Text("No items detected")
                                    .font(.headline)
                                Text(debugText) // Show debug info if empty
                                    .font(.caption)
                                    .foregroundColor(.gray)
                                    .padding()
                                
                                Button("Try Again") {
                                    selectedImage = nil
                                }
                            }
                        } else {
                            // MARK: - Item Assignment View
                            VStack {
                                HStack {
                                    Text("Assign Items")
                                        .font(.headline)
                                    Spacer()
                                    if !isTotalMatching {
                                        HStack(spacing: 4) {
                                            Image(systemName: "exclamationmark.triangle.fill")
                                                .foregroundColor(.orange)
                                            Text("Check Total")
                                                .font(.caption)
                                                .fontWeight(.bold)
                                                .foregroundColor(.orange)
                                        }
                                    }
                                }
                                .padding(.horizontal)
                                .padding(.top)
                                
                                List {
                                    ForEach(scannedItems) { item in
                                        VStack(alignment: .leading, spacing: 8) {
                                            HStack {
                                                // Checkbox for selection (include/exclude from bill)
                                                Button(action: {
                                                    toggleItemSelection(item.id)
                                                }) {
                                                    Image(systemName: selectedItemIds.contains(item.id) ? "checkmark.circle.fill" : "circle")
                                                        .foregroundColor(selectedItemIds.contains(item.id) ? .indigo : .secondary)
                                                        .font(.title3)
                                                }
                                                .buttonStyle(.plain)
                                                
                                                Text(item.name)
                                                    .lineLimit(2)
                                                    .font(.body)
                                                    .fontWeight(.medium)
                                                
                                                Spacer()
                                                
                                                Text(String(format: "$%.2f", item.price))
                                                    .fontWeight(.bold)
                                                    .monospacedDigit()
                                            }
                                            
                                            // Assignment Dropdown
                                            if selectedItemIds.contains(item.id) {
                                                Menu {
                                                    Button(action: { assignItem(item.id, to: nil) }) {
                                                        if assignments[item.id]?.isEmpty ?? true {
                                                            Label("Everyone (Split Evenly)", systemImage: "checkmark")
                                                        } else {
                                                            Text("Everyone (Split Evenly)")
                                                        }
                                                    }
                                                    
                                                    Divider()
                                                    
                                                    ForEach(members) { member in
                                                        Button(action: { toggleAssignment(item.id, memberId: member.id) }) {
                                                            let isAssigned = assignments[item.id]?.contains(member.id) ?? false
                                                            if isAssigned {
                                                                Label(member.fullName, systemImage: "checkmark")
                                                            } else {
                                                                Text(member.fullName)
                                                            }
                                                        }
                                                    }
                                                } label: {
                                                    HStack {
                                                        Image(systemName: "person.2")
                                                            .font(.caption)
                                                        
                                                        Text(assignmentLabel(for: item.id))
                                                            .font(.caption)
                                                            .lineLimit(1)
                                                        
                                                        Spacer()
                                                        
                                                        Image(systemName: "chevron.down")
                                                            .font(.caption2)
                                                    }
                                                    .padding(.horizontal, 10)
                                                    .padding(.vertical, 6)
                                                    .background(Color.indigo.opacity(0.1))
                                                    .foregroundColor(.indigo)
                                                    .cornerRadius(8)
                                                }
                                            }
                                        }
                                        .padding(.vertical, 4)
                                    }
                                    
                                    // Tax / Total Info Selection
                                    Section(header: Text("Calculations")) {
                                        HStack {
                                            Text("Subtotal")
                                                .foregroundColor(.secondary)
                                            Spacer()
                                            Text(String(format: "$%.2f", subtotalSelected))
                                        }
                                        
                                        if taxItem != nil {
                                            HStack {
                                                Text("Tax (Proportional)")
                                                Spacer()
                                                Text(String(format: "+$%.2f", calculatedTax))
                                                    .foregroundColor(.orange)
                                            }
                                        }
                                        
                                        HStack {
                                            Text("Final Total")
                                                .fontWeight(.bold)
                                            Spacer()
                                            Text(String(format: "$%.2f", finalTotal))
                                                .fontWeight(.bold)
                                                .foregroundColor(.indigo)
                                        }
                                        
                                        if let detected = detectedTotalItem {
                                            HStack {
                                                Text("Receipt Total")
                                                    .font(.caption)
                                                    .foregroundColor(.secondary)
                                                Spacer()
                                                Text("Scanned: \(String(format: "$%.2f", detected.price))")
                                                    .font(.caption)
                                                    .foregroundColor(isTotalMatching ? .green : .orange)
                                            }
                                        }
                                    }
                                }
                                .listStyle(.insetGrouped)
                                
                                // Footer
                                VStack(spacing: 12) {
                                    Divider()
                                    
                                    Button(action: finalizeAndContinue) {
                                        Text("Continue with Splits")
                                            .fontWeight(.bold)
                                            .frame(maxWidth: .infinity)
                                            .padding()
                                            .background(Color.indigo)
                                            .foregroundColor(.white)
                                            .cornerRadius(12)
                                    }
                                    .disabled(finalTotal == 0)
                                    .opacity(finalTotal == 0 ? 0.6 : 1)
                                }
                                .padding()
                                .background(Color(uiColor: .systemBackground).ignoresSafeArea(edges: .bottom))
                            }
                        }
                    }
                } else {
                    // Initial State
                    VStack(spacing: 24) {
                        Image(systemName: "camera.viewfinder")
                            .font(.system(size: 64))
                            .foregroundColor(.indigo)
                        
                        Text("Scan a Receipt")
                            .font(.title2)
                            .fontWeight(.bold)
                        
                        Text("Take a photo or upload an image to automatically detect items and prices.")
                            .multilineTextAlignment(.center)
                            .foregroundColor(.secondary)
                            .padding(.horizontal)
                        
                        VStack(spacing: 12) {
                            Button(action: { showingCamera = true }) {
                                Label("Take Photo", systemImage: "camera.fill")
                                    .fontWeight(.semibold)
                                    .frame(maxWidth: .infinity)
                                    .padding()
                                    .background(Color.indigo)
                                    .foregroundColor(.white)
                                    .cornerRadius(12)
                            }
                            
                            PhotosPicker(selection: $selectedPhotoItem, matching: .images) {
                                Label("Upload from Library", systemImage: "photo.on.rectangle")
                                    .fontWeight(.semibold)
                                    .frame(maxWidth: .infinity)
                                    .padding()
                                    .background(Color.gray.opacity(0.1))
                                    .foregroundColor(.primary)
                                    .cornerRadius(12)
                            }
                            
                            Button("Enter Manually") {
                                onManualEntry()
                                dismiss()
                            }
                            .font(.headline)
                            .foregroundColor(.indigo)
                            .padding(.top, 8)
                        }
                        .padding(.horizontal, 40)
                    }
                }
            }
            .navigationTitle("Scan Receipt")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                if selectedImage != nil {
                    ToolbarItem(placement: .primaryAction) {
                        Button("Retake") {
                            selectedImage = nil
                            scannedItems = []
                            selectedItemIds = []
                        }
                    }
                }
            }
            .sheet(isPresented: $showingCamera) {
                CameraScannerView(image: $selectedImage)
            }
            .onChange(of: selectedPhotoItem) { _, newItem in
                Task {
                    if let data = try? await newItem?.loadTransferable(type: Data.self),
                       let uiImage = UIImage(data: data) {
                        selectedImage = uiImage
                    }
                }
            }
            // Trigger scan when image is set
            .onChange(of: selectedImage) { _, newImage in
                if let image = newImage {
                    scanReceipt(image: image)
                }
            }
        }
    }
    
    // MARK: - Scanning Logic
    
    // TEMPORARY: Gemini API Scan
    private func scanReceipt(image: UIImage) {
        isScanning = true
        scannedItems = []
        selectedItemIds = []
        debugText = "Sending to Gemini..."
        
        GeminiScannerService.shared.scanReceipt(image: image) { result in
            DispatchQueue.main.async {
                self.isScanning = false
                switch result {
                case .success(let items):
                    // Logic to separate Tax and Total
                    var regularItems: [ScannedItem] = []
                    var tax: ScannedItem?
                    var total: ScannedItem?
                    
                    for item in items {
                        let name = item.name.lowercased()
                        if name.contains("total") && !name.contains("subtotal") {
                            // Assume this is the Grand Total
                            // (Logic: If we have multiple, take the largest or last? Usually API sends Total last)
                            if total == nil || item.price > total!.price {
                                total = item
                            }
                        } else if name.contains("tax") {
                            // Assume this is Tax
                            tax = item
                        } else {
                            regularItems.append(item)
                        }
                    }
                    
                    self.scannedItems = regularItems
                    self.taxItem = tax
                    self.detectedTotalItem = total
                    
                    // Select all regular items by default
                    self.selectedItemIds = Set(regularItems.map { $0.id })
                    self.assignments = [:] // Reset assignments
                    self.debugText = "Gemini found \(items.count) items"
                case .failure(let error):
                    // Show error in debug text (e.g. "Quota exceeded")
                    self.debugText = "Error: \(error.localizedDescription)"
                }
            }
        }
    }
    
    
    
    
    // MARK: - Camera Helper
    
    struct CameraScannerView: UIViewControllerRepresentable {
        @Binding var image: UIImage?
        @Environment(\.dismiss) var dismiss
        
        func makeUIViewController(context: Context) -> UIImagePickerController {
            let picker = UIImagePickerController()
            picker.delegate = context.coordinator
            picker.sourceType = .camera
            return picker
        }
        
        func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}
        
        func makeCoordinator() -> Coordinator {
            Coordinator(self)
        }
        
        class Coordinator: NSObject, UINavigationControllerDelegate, UIImagePickerControllerDelegate {
            let parent: CameraScannerView
            
            init(_ parent: CameraScannerView) {
                self.parent = parent
            }
            
            func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]) {
                if let uiImage = info[.originalImage] as? UIImage {
                    parent.image = uiImage
                }
                parent.dismiss()
            }
            
            func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
                parent.dismiss()
            }
        }
    }
}

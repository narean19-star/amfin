function accountingApp() {
    return {
        // State
        view: 'dashboard',
        isLoading: true,
        loadingMsg: '',
        progress: 0,
        sidebarOpen: false,
        toasts: [],
        showInstallPrompt: false,
        // Notification Center State
        notifications: [],
        showNotificationCenter: false,
        unreadNotificationCount: 0,

        // Global filters
        filterFrom: '',
        filterTo: '',

        // Data stores
        entries: [],
        purchases: [],
        expenses: [],
        cheques: [],

        // Master lists
        owners: [],
        customers: [],
        items: [],
        suppliers: [],
        expenseCategories: ['Rent', 'Salaries', 'Fuel & Transport', 'Electricity', 'Telephone', 'Maintenance', 'Stationery', 'Miscellaneous'],
        expenseCategoryKeywords: {
            'Fuel & Transport': ['fuel', 'petrol', 'diesel', 'transport', 'travel', 'bus', 'train', 'flight', 'taxi', 'uber'],
            'Salaries': ['salary', 'payroll', 'wages'],
            'Rent': ['rent', 'lease', 'office space'],
            'Electricity': ['electricity', 'power bill'],
            'Telephone': ['telephone', 'internet', 'mobile', 'phone bill', 'data'],
            'Maintenance': ['maintenance', 'repair', 'service', 'amc'],
            'Stationery': ['stationery', 'pen', 'paper', 'print', 'office supplies'],
            'Miscellaneous': ['misc', 'sundry']
        },

        // Search fields
        searchRecords: '',
        searchOwner: '',
        searchCustomer: '',
        searchPurchases: '',
        searchOutstanding: '',
        searchExpenses: '',
        billSearch: '',
        foundBill: null,
        recordsTab: 'all',
        chequeTab: 'all',
        debtorsTab: 'debtors',

        // Forms
        saleForm: {},
        purchaseForm: {},
        expenseForm: {},
        chequeForm: {},

        // Analysis filters
        analysisOwner: '',
        analysisCustomer: '',

        // New item inputs for master
        newOwnerInput: '',
        newCustInput: '',
        newItemInput: '',
        newCatInput: '',
        newSupplierInput: '',
        newOwnerMode: false,
        newCustMode: false,
        newItemMode: false,

        // AI Assistant state
        aiPrompt: '',
        aiInsight: '',
        isAILoading: false,

        // Charts
        _charts: {},
        _persistTimer: null,

        get viewTitle() {
            const titles = { dashboard: 'Dashboard', records: 'Sales Ledger', entry: 'Sale Entry', purchases: 'Purchases', cheques: 'Cheque Registry', cashflow: 'Expenses & Cashflow', analysis: 'P&L Analysis', debtors: 'Debtors & Creditors', financials: 'Financial Reports', master: 'Master Data' };
            return titles[this.view] || 'AM Sales Pro v10';
        },

        // ─── Formatters ─────────────────────────────────────────────
        fc(v) { return new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', maximumFractionDigits: 0 }).format(v || 0); },
        fn(v) { if (v === undefined || v === null || v === '' || isNaN(v)) return '0'; return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v); },
        fd(d) { if (!d) return ''; const p = String(d).split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d; },
        
        // ─── Toasts & Notifications ─────────────────────────────────
        toast(title, msg, type = 'info') {
            const id = Date.now() + Math.random();
            const newToast = { id, title, msg, type, time: new Date() };
            
            // For on-screen toasts
            this.toasts.push(newToast);
            setTimeout(() => this.removeToast(id), 4000);

            // For notification center history
            this.notifications.unshift(newToast);
            if (this.notifications.length > 50) { // Keep only last 50
                this.notifications.pop();
            }
            this.unreadNotificationCount++;
        },
        removeToast(id) { this.toasts = this.toasts.filter(t => t.id !== id); },

        toggleNotificationCenter() {
            this.showNotificationCenter = !this.showNotificationCenter;
            if (this.showNotificationCenter) {
                this.unreadNotificationCount = 0;
            }
        },

        clearNotifications() {
            this.notifications = [];
            this.unreadNotificationCount = 0;
            this.showNotificationCenter = false;
        },

        // ─── Init & Persist ─────────────────────────────────────────
        async init() {
            // Handle deep linking from 404 redirect
            const redirectedView = sessionStorage.getItem('redirectView');
            if (redirectedView) {
                // List of valid views to prevent navigating to a non-existent state
                const validViews = ['dashboard', 'records', 'entry', 'purchases', 'cheques', 'cashflow', 'analysis', 'debtors', 'financials', 'master'];
                if (validViews.includes(redirectedView)) {
                    this.view = redirectedView;
                    this.toast('Redirected', `Navigated to the ${redirectedView} page.`, 'info');
                }
                sessionStorage.removeItem('redirectView'); // Clean up after use
            }

            this.isLoading = true;
            this.loadingMsg = 'Connecting to database...';
            this.progress = 20;
            this.resetSaleForm(); this.resetPurchaseForm(); this.resetExpenseForm(); this.resetChequeForm();

            try {
                const data = await loadDataFromSupabase();
                this.applyCloudData(data);
                this.toast('Connected', 'Data loaded from Supabase.', 'success');
            } catch (e) {
                this.toast('Connection Error', 'Could not load from Supabase. Using local data. ' + e.message, 'error');
                console.warn("Supabase load failed, falling back to localStorage.", e);
                // Fallback to local storage if Supabase fails
                try {
                    let raw = localStorage.getItem('am_accounts_v10');
                    if (raw) {
                        const d = JSON.parse(raw);
                        this.applyCloudData(d);
                        this.toast('Offline Mode', 'Loaded data from local backup.', 'info');
                    } else {
                        // Try migrating from old v9 format
                        raw = localStorage.getItem('am_accounts_v9');
                        if (raw) {
                            const d = JSON.parse(raw);
                            this.applyCloudData(d);
                            this.toast('Migration', 'Data migrated to new version. Please verify.', 'info');
                            this.persist(); // Save the migrated data
                        }
                    }
                } catch (localError) {
                    this.toast('Fatal Error', 'Could not load any data: ' + localError.message, 'error');
                }
            }
            this.progress = 100;
            this.$watch('entries', () => { this.updateCharts(); });
            this.$watch('view', v => { if (v === 'dashboard' || v === 'analysis') setTimeout(() => this.updateCharts(), 80); });
            setTimeout(() => this.updateCharts(), 500);
            setTimeout(() => { this.isLoading = false; }, 300);

            // Check if we should show the iOS install prompt.
            this.checkForInstallPrompt();

            // Add a listener to ensure data is saved to local storage before the user leaves.
            window.addEventListener('beforeunload', () => {
                if (this._persistTimer) {
                    // A save is pending. Cancel the async timer and save synchronously to localStorage.
                    // This is the most reliable way to prevent data loss on tab close.
                    clearTimeout(this._persistTimer);
                    localStorage.setItem('am_accounts_v10', JSON.stringify(this.buildAppData()));
                }
            });
        },

        persist() {
            if (this._persistTimer) clearTimeout(this._persistTimer);
            this._persistTimer = setTimeout(async () => {
                await this.forceSave();
            }, 1000); // Debounce for 1 second
        },

        buildAppData() {
            return {
                entries: this.entries,
                purchases: this.purchases,
                expenses: this.expenses,
                cheques: this.cheques,
                owners: this.owners,
                customers: this.customers,
                items: this.items,
                suppliers: this.suppliers,
                expenseCategories: this.expenseCategories,
                lastSaved: new Date().toISOString()
            };
        },

        applyCloudData(data) {
            this.entries = (data.entries || []).map(e => this.normalizeSaleEntry(e));
            this.purchases = data.purchases || [];
            this.expenses = data.expenses || [];
            this.cheques = data.cheques || [];
            this.owners = data.owners || [];
            this.customers = data.customers || [];
            this.items = data.items || [];
            this.suppliers = data.suppliers || [];
            this.expenseCategories = data.expenseCategories || this.expenseCategories;
        },

        async forceSave() {
            if (this._persistTimer) clearTimeout(this._persistTimer);
            const data = this.buildAppData();
            // Always save to local storage as a backup
            localStorage.setItem('am_accounts_v10', JSON.stringify(data));
            
            // Attempt to save to Supabase
            try {
                this.loadingMsg = 'Saving...';
                this.isLoading = true;
                await saveDataToSupabase(data);
                this.toast('Saved', 'Changes saved to the database.', 'success');
            } catch (error) {
                this.toast('Save Error', 'Could not save to Supabase. ' + error.message, 'error');
                console.error("Supabase save failed.", error);
            } finally {
                this.isLoading = false;
            }
        },

        // ─── AI Assistant ───────────────────────────────────────────
        async getAIInsight() {
            if (!this.aiPrompt.trim()) {
                this.toast('AI Assistant', 'Please enter a question.', 'warning');
                return;
            }

            this.isAILoading = true;
            this.aiInsight = ''; // Clear previous insight

            try {
                // Build a smarter, more detailed context for the AI.
                const context = this.buildAIContext();
                
                const fullPrompt = `You are a helpful financial assistant. Based on the following data summary, please answer the user's question. Be concise and clear.

--- Data Summary ---
${context}
--- End of Summary ---

User Question: "${this.aiPrompt}"`;

                const response = await getGroqChatCompletion(fullPrompt);
                this.aiInsight = response;
            } catch (error) {
                console.error('Error getting AI insight:', error);
                this.aiInsight = `Failed to get a response from the AI. ${error.message}`;
                this.toast('AI Error', error.message, 'error');
            } finally {
                this.isAILoading = false;
            }
        },

        buildAIContext() {
            // This helper function builds a context string with key financial metrics.
            // Assumes computed properties like 'totals' and 'summariesByCustomer' are available.
            const summary = {
                period: { from: this.filterFrom || 'start', to: this.filterTo || 'today' },
                sales: { totalRevenue: this.totals.sales, transactionCount: this.entries.length },
                profitability: { grossProfit: this.totals.grossProfit, netProfit: this.totals.netProfit, netMarginPercent: this.totals.sales > 0 ? (this.totals.netProfit / this.totals.sales * 100) : 0 },
                outstandingDebtors: { totalOwed: this.totals.outstanding, count: this.summariesByOutstanding.length },
                topCustomers: this.summariesByCustomer.slice(0, 5).map(c => ({ customer: c.customer, revenue: c.revenue })),
            };
            // Convert the summary object to a string for the prompt.
            return JSON.stringify(summary, null, 2);
        },

        normalizeSaleEntry(e) {
            const numericFields = ['Pkgs', 'P.Kilo', 'G.Kilo', 'Tare', 'N.Kilo', 'Rate', 'Kooli', 'C.Amount', 'A.Amount', 'Cash', 'Cheque', 'Credit Given', 'Credit Received', 'Balance'];
            const entry = { ...e };
            numericFields.forEach(field => {
                entry[field] = parseFloat(entry[field]) || 0;
            });
            // Ensure ID exists for upsert
            if (!entry.id) {
                // A simple UUID generator. Supabase will generate one if it's null on insert, but it's good practice for client-side operations.
                entry.id = ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
            }
            return entry;
        },

        autoCategorizeExpense() {
            if (this.expenseForm.category && this.expenseForm.category.trim() !== '') {
                return; // Don't overwrite if a category is already set
            }
            const description = (this.expenseForm.description || '').toLowerCase();
            if (!description) return;

            for (const category in this.expenseCategoryKeywords) {
                for (const keyword of this.expenseCategoryKeywords[category]) {
                    if (description.includes(keyword)) {
                        this.expenseForm.category = category;
                        this.toast('Auto-Categorized', `Set category to "${category}"`, 'info');
                        return; // Stop after first match
                    }
                }
            }
        },

        // ─── Data Management ────────────────────────────────────────
        backupJSON() {
            const data = this.buildAppData();
            const jsonString = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `amfin_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.toast('Backup Complete', 'A local JSON backup has been downloaded.', 'success');
        },

        importJSON(event) {
            const file = event.target.files[0];
            if (!file) {
                this.toast('No file selected', 'Please select a JSON backup file to import.', 'warning');
                return;
            }

            this.isLoading = true;
            this.loadingMsg = 'Importing JSON backup...';

            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);

                    // Basic validation to see if it looks like our data
                    if (!data.entries && !data.owners) {
                        throw new Error('JSON file does not appear to be a valid backup.');
                    }

                    const confirmation = prompt('This will overwrite ALL local and cloud data with the backup. This cannot be undone. Are you sure? Type "IMPORT" to confirm.');
                    if (confirmation !== 'IMPORT') {
                        this.toast('Import Cancelled', 'The import operation was cancelled.', 'info');
                        this.isLoading = false;
                        this.loadingMsg = '';
                        event.target.value = '';
                        return;
                    }

                    this.applyCloudData(data);
                    this.toast('Import Complete', 'Data has been restored from the JSON backup. Saving to cloud...', 'success');
                    this.forceSave(); // Immediately save the restored data to Supabase
                } catch (error) {
                    console.error("Error importing JSON file:", error);
                    this.toast('Import Error', `Failed to process the JSON file. ${error.message}`, 'error');
                    this.isLoading = false;
                } finally {
                    event.target.value = ''; // Reset file input
                }
            };

            reader.onerror = (error) => {
                console.error("FileReader error:", error);
                this.toast('File Read Error', 'Could not read the selected file.', 'error');
                this.isLoading = false;
                this.loadingMsg = '';
                event.target.value = '';
            };

            reader.readAsText(file);
        },

        importExcel(event) {
            const file = event.target.files[0];
            if (!file) {
                this.toast('No file selected', 'Please select an Excel file to import.', 'warning');
                return;
            }

            this.isLoading = true;
            this.loadingMsg = 'Importing Excel data...';
            this.progress = 0;

            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                    this.progress = 10;

                    const processSheet = (sheetName, dataArrayName, normalizer) => {
                        const sheet = workbook.Sheets[sheetName];
                        if (!sheet) return;

                        let jsonData = XLSX.utils.sheet_to_json(sheet);
                        
                        jsonData = jsonData.map(row => {
                            const newRow = { ...row };
                            // Convert Excel date to YYYY-MM-DD string for all relevant date fields
                            ['Date', 'date', 'clearDate'].forEach(dateField => {
                                if (newRow[dateField] && newRow[dateField] instanceof Date) {
                                    const d = newRow[dateField];
                                    const y = d.getFullYear();
                                    const m = String(d.getMonth() + 1).padStart(2, '0');
                                    const day = String(d.getDate()).padStart(2, '0');
                                    newRow[dateField] = `${y}-${m}-${d}`;
                                }
                            });

                            return normalizer ? normalizer(newRow) : newRow;
                        });

                        const existingIds = new Set(this[dataArrayName].map(item => item.id));
                        const newData = jsonData.filter(item => !item.id || !existingIds.has(item.id));

                        if (newData.length > 0) {
                            this[dataArrayName] = [...this[dataArrayName], ...newData];
                            this.toast(`Imported ${sheetName}`, `${newData.length} new records added.`, 'info');
                        }
                    };

                    processSheet('Sales', 'entries', this.normalizeSaleEntry.bind(this));
                    this.progress = 40;
                    processSheet('Purchases', 'purchases');
                    this.progress = 60;
                    processSheet('Expenses', 'expenses');
                    this.progress = 80;
                    processSheet('Cheques', 'cheques');
                    this.progress = 90;

                    this.toast('Import Complete', 'Excel data has been processed.', 'success');
                    this.updateMastersFromData();
                    this.persist();

                } catch (error) {
                    console.error("Error importing Excel file:", error);
                    this.toast('Import Error', `Failed to process the Excel file. ${error.message}`, 'error');
                } finally {
                    this.progress = 100;
                    setTimeout(() => { this.isLoading = false; this.loadingMsg = ''; }, 500);
                    event.target.value = ''; // Reset file input
                }
            };

            reader.onerror = (error) => {
                console.error("FileReader error:", error);
                this.toast('File Read Error', 'Could not read the selected file.', 'error');
                this.isLoading = false;
                this.loadingMsg = '';
                event.target.value = '';
            };

            reader.readAsArrayBuffer(file);
        },

        updateMastersFromData() {
            const newOwners = new Set(this.owners);
            this.entries.forEach(e => e.Owner && newOwners.add(e.Owner));
            this.owners = Array.from(newOwners).sort();

            const newCustomers = new Set(this.customers);
            this.entries.forEach(e => e.Customer && newCustomers.add(e.Customer));
            this.customers = Array.from(newCustomers).sort();

            const newItems = new Set(this.items);
            this.entries.forEach(e => e.Item && newItems.add(e.Item));
            this.purchases.forEach(p => p.item && newItems.add(p.item));
            this.items = Array.from(newItems).sort();

            const newSuppliers = new Set(this.suppliers);
            this.purchases.forEach(p => p.supplier && newSuppliers.add(p.supplier));
            this.suppliers = Array.from(newSuppliers).sort();
            
            this.toast('Master Data Updated', 'Dropdown lists have been updated from imported data.', 'info');
        },

        async clearAllData() {
            const confirmation = prompt('This will delete ALL data from the cloud database. This cannot be undone.\n\nTo confirm, please type "DELETE" below:');
            if (confirmation === 'DELETE') {
                this.isLoading = true;
                this.loadingMsg = 'Deleting all cloud data...';
                try {
                    await clearAllSupabaseData();
                    this.toast('Success', 'All cloud data has been deleted. The app will now reload.', 'success');
                    // Clear local storage to prevent reloading old data
                    localStorage.removeItem('am_accounts_v10');
                    localStorage.removeItem('am_accounts_v9');
                    setTimeout(() => location.reload(), 2000);
                } catch (error) {
                    this.toast('Error', 'Could not clear cloud data. ' + error.message, 'error');
                    this.isLoading = false;
                }
            } else {
                this.toast('Cancelled', 'Clear data operation was cancelled.', 'info');
            }
        },

        // ─── PWA Install Prompt for iOS ─────────────────────────────
        checkForInstallPrompt() {
            const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
            // The 'standalone' property is a non-standard API supported by Mobile Safari.
            const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator.standalone);
            const hasDismissed = localStorage.getItem('amfin_install_prompt_dismissed') === 'true';

            if (isIOS && !isInStandaloneMode && !hasDismissed) {
                this.showInstallPrompt = true;
            }
        },

        dismissInstallPrompt() {
            this.showInstallPrompt = false;
            localStorage.setItem('amfin_install_prompt_dismissed', 'true');
            this.toast('Prompt Dismissed', 'You can still add this app via the share menu.', 'info');
        },
    };
}
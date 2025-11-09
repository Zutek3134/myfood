class DataManagement {
    constructor(config) {
        this._validateDependencies(config);
        this.storageKeys = config.storageKeys;
        this.state = config.state;
        this.loadData = config.loadData;
        this.renderMealLogs = config.renderMealLogs;
        this.renderFavStores = config.renderFavStores;
        this.updatePopularItemsFromLogs = config.updatePopularItemsFromLogs;
        this.initAutoComplete = config.initAutoComplete;
        this.updateFilterDropdown = config.updateFilterDropdown;
        this.dom = config.domElements;
        this.getLocalDatetime = window.getLocalDatetime;
        this.pako = config.pako || window.pako;
        this._bindEvents();
    }
    _validateDependencies(config) {
        if (!config.storageKeys || !["MEALLOGS", "FAVSTORES", "POPULAR_ITEMS"].every(key => config.storageKeys[key]))
            throw new Error("DataManagement 缺少必要的 storageKeys 配置（需包含 MEALLOGS/FAVSTORES/POPULAR_ITEMS）");
        if (!config.state || typeof config.state !== "object") throw new Error("DataManagement 必須傳入 state 狀態物件");
        if (typeof config.loadData !== "function") throw new Error("DataManagement 必須傳入 loadData 載入數據函式");
        if (typeof config.renderMealLogs !== "function")
            throw new Error("DataManagement 必須傳入 renderMealLogs 渲染用餐紀錄函式");
        if (typeof config.renderFavStores !== "function")
            throw new Error("DataManagement 必須傳入 renderFavStores 渲染餐廳函式");
        if (typeof config.updatePopularItemsFromLogs !== "function")
            throw new Error("DataManagement 必須傳入 updatePopularItemsFromLogs 更新熱門菜品函式");
        if (typeof config.updateFilterDropdown !== "function")
            throw new Error("DataManagement 必須傳入 updateFilterDropdown 更新篩選下拉選單函式");
        if (!config.domElements || !["exportBtn", "importBtn", "fileInput", "deleteAll"].every(el => config.domElements[el]))
            throw new Error("DataManagement 缺少必要的 DOM 元素配置（需包含 exportBtn/importBtn/fileInput/deleteAll）");
    }
    _bindEvents() {
        this.dom.exportBtn.addEventListener("click", () => this.exportDataCompressed());
        this.dom.importBtn.addEventListener("click", () => this.triggerImport());
        this.dom.fileInput.addEventListener("change", e => this.importData(e));
        this.dom.deleteAll.addEventListener("click", () => {
            if (confirm("確定刪除所有紀錄？")) {
                this.state.mealLogs = [];
                this.state.filteredMealLogs = [];
                this.saveToStorageWithCompression(this.storageKeys.MEALLOGS, this.state.mealLogs);
                this.updatePopularItemsFromLogs();
                this.renderMealLogs();
            }
        });
    }
    triggerImport() {
        this.dom.fileInput.value = "";
        this.dom.fileInput.click();
    }
    validateImportData(data) {
        return data && typeof data === "object" && Array.isArray(data.mealLogs) && Array.isArray(data.favStores) && typeof data.popularItems === "object" && data.popularItems !== null;
    }
    saveToStorageWithCompression(key, data) {
        try {
            const defaultValue = Array.isArray(data) ? [] : {};
            const jsonStr = JSON.stringify(data ?? defaultValue);
            const compressed = this.pako.gzip(jsonStr);
            const encoded = btoa(String.fromCharCode.apply(null, compressed));
            localStorage.setItem(key, encoded);
            return true;
        } catch (err) {
            console.error("壓縮儲存失敗：", err);
            window.showToast("數據儲存失敗，請重試");
            return false;
        }
    }
    loadFromStorageWithCompression(key, defaultValue) {
        try {
            const stored = localStorage.getItem(key);
            if (!stored) return defaultValue;
            const decoded = new Uint8Array(atob(stored).split("").map(char => char.charCodeAt(0)));
            const decompressed = this.pako.ungzip(decoded, { to: "string" });
            return JSON.parse(decompressed);
        } catch (err) {
            console.error("解壓縮讀取失敗：", err);
            window.showToast("數據讀取失敗，使用預設值");
            return defaultValue;
        }
    }
    exportDataCompressed() {
        try {
            const exportData = {
                mealLogs: this.state.mealLogs || [],
                favStores: this.state.favStores || [],
                popularItems: this.state.popularItems || {}
            };
            const jsonStr = JSON.stringify(exportData);
            const compressed = this.pako.gzip(jsonStr);
            const blob = new Blob([compressed], { type: "application/octet-stream" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const date = this.getLocalDatetime();
            const [year, month, day] = date.split("-");
            const rocYear = parseInt(year, 10) - 1911;
            const time = new Date().toTimeString().slice(0, 5).replace(":", "");
            a.download = `吃吃吃_${rocYear}${month}${day}-${time}.myfood`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
            window.showToast("成功匯出資料");
        } catch (err) {
            console.error("壓縮匯出失敗：", err);
            window.showToast("壓縮資料匯出失敗，請重試");
        }
    }
    importData(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = loadEvent => this.handleImportContent(loadEvent.target.result, file.name);
        reader.onerror = () => window.showToast("檔案讀取失敗，請重試");
        if (file.name.endsWith(".myfood")) reader.readAsArrayBuffer(file);
        else reader.readAsText(file);
    }
    handleImportContent(content, fileName) {
        try {
            let parsedData;
            if (fileName.endsWith(".myfood")) {
                const uint8Array = new Uint8Array(content);
                const decompressed = this.pako.ungzip(uint8Array, { to: "string" });
                parsedData = JSON.parse(decompressed);
            } else if (this.isBase64(content)) {
                const uint8Array = new Uint8Array(atob(content).split("").map(char => char.charCodeAt(0)));
                const text = new TextDecoder("utf-8").decode(uint8Array);
                parsedData = JSON.parse(text);
            } else {
                parsedData = JSON.parse(content);
            }
            if (!this.validateImportData(parsedData)) {
                window.showToast("檔案格式不正確，請使用正確的備份檔案");
                return;
            }
            if (confirm("是否匯入資料？原紀錄將被覆蓋！")) {
                this.saveToStorageWithCompression(this.storageKeys.MEALLOGS, parsedData.mealLogs || []);
                this.saveToStorageWithCompression(this.storageKeys.FAVSTORES, parsedData.favStores || []);
                this.saveToStorageWithCompression(this.storageKeys.POPULAR_ITEMS, parsedData.popularItems || {});
                this.loadData();
                this.renderMealLogs();
                this.updatePopularItemsFromLogs();
                this.initAutoComplete();
                this.updateFilterDropdown();
                window.showToast("成功匯入資料");
            }
        } catch (err) {
            console.error("匯入失敗：", err);
            window.showToast("檔案解析錯誤，請檢查檔案是否完好");
        }
    }
    isBase64(str) {
        if (typeof str !== "string" || str.length === 0) return false;
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(str)) return false;
        try {
            return btoa(atob(str)) === str;
        } catch (err) {
            return false;
        }
    }
}

class Dropdown {
    constructor() {
        this.init();
    }
    init() {
        document.querySelectorAll(".dropdown").forEach(dropdown => {
            const trigger = dropdown.querySelector(".dropdown-trigger");
            const list = dropdown.querySelector("ul");
            trigger.addEventListener("click", e => {
                e.stopPropagation();
                document.querySelectorAll(".dropdown").forEach(d => d !== dropdown && d.classList.remove("open"));
                dropdown.classList.toggle("open");
            });
            list.addEventListener("click", e => {
                const item = e.target.closest("li");
                if (!item) return;
                const text = item.textContent;
                trigger.querySelector("span:first-child").textContent = text;
                list.querySelectorAll("li").forEach(i => i.classList.remove("selected"));
                item.classList.add("selected");
                dropdown.classList.remove("open");
                dropdown.dispatchEvent(new CustomEvent("change", { detail: { textContent: text } }));
            });
        });
        document.addEventListener("click", () => {
            document.querySelectorAll(".dropdown").forEach(d => d.classList.remove("open"));
        });
    }
    create(text, isSelected = false) {
        const li = document.createElement("li");
        li.className = isSelected ? "selected" : "";
        li.textContent = text;
        return li;
    }
    update(listEl, items, keepExisting = true) {
        if (!keepExisting) listEl.innerHTML = "";
        const fragment = document.createDocumentFragment();
        items.sort((a, b) => window.compareBpmf(a, b)).forEach(text => {
            fragment.appendChild(this.create(text));
        });
        listEl.appendChild(fragment);
    }
}

class AutoComplete {
    constructor(config) {
        this.config = {
            inputElement: null,
            suggestionsContainer: null,
            dataSource: () => [],
            filterKey: "name",
            displayTemplate: item => item.name,
            onSelect: () => { },
            debounceDelay: 50,
            ...config
        };
        this.clickOutsideHandler = this.handleClickOutside.bind(this);
        this.init();
    }
    init() {
        const { inputElement, suggestionsContainer } = this.config;
        if (!inputElement || !suggestionsContainer) return console.warn("自動完成初始化失敗：缺少必要元件");
        inputElement.autoCompleteInstance = this;
        const debouncedFilter = this.debounce(e => {
            const value = e.target.value;
            this.filterAndRender(value);
        }, this.config.debounceDelay);
        inputElement.addEventListener("input", debouncedFilter);
        inputElement.addEventListener("focus", () => {
            this.filterAndRender(inputElement.value);
        });
        suggestionsContainer.addEventListener("click", e => {
            const item = e.target.closest(".auto-complete-suggestion");
            if (item) {
                const value = item.dataset.value;
                inputElement.value = value;
                this.hideSuggestions();
                this.config.onSelect(value, item.dataset);
            }
        });
        inputElement.addEventListener("keydown", e => this.handleKeyboard(e));
        this.addClickOutsideListener();
    }
    addClickOutsideListener() {
        document.addEventListener("click", this.clickOutsideHandler, true);
    }
    handleClickOutside(e) {
        const { inputElement, suggestionsContainer } = this.config;
        const isClickInInput = inputElement.contains(e.target);
        const isClickInSuggestions = suggestionsContainer.contains(e.target);
        if (!isClickInInput && !isClickInSuggestions) this.hideSuggestions();
    }
    filterAndRender(value) {
        const { dataSource, filterKey, suggestionsContainer, displayTemplate } = this.config;
        const data = dataSource();
        const lowerValue = value.trim().toLowerCase();
        const filtered = lowerValue ? data.filter(item => item[filterKey]?.toLowerCase().includes(lowerValue)) : data.slice(0, 5);
        if (filtered.length > 0) {
            suggestionsContainer.innerHTML = filtered.map(item => `
                <li class="auto-complete-suggestion" data-value="${item[filterKey]}" data-${filterKey}="${item[filterKey]}">
                    ${displayTemplate(item)}
                </li>
            `).join("");
            this.showSuggestions();
        } else {
            this.hideSuggestions();
        }
    }
    showSuggestions() {
        this.config.suggestionsContainer.parentElement.classList.add("open");
    }
    hideSuggestions() {
        this.config.suggestionsContainer.parentElement.classList.remove("open");
    }
    handleKeyboard(e) {
        const { suggestionsContainer, inputElement } = this.config;
        const items = suggestionsContainer.querySelectorAll(".auto-complete-suggestion");
        if (items.length === 0) return;
        let activeIndex = Array.from(items).findIndex(item => item.classList.contains("active"));
        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                activeIndex = activeIndex < items.length - 1 ? activeIndex + 1 : 0;
                this.setActiveSuggestion(items, activeIndex);
                break;
            case "ArrowUp":
                e.preventDefault();
                activeIndex = activeIndex > 0 ? activeIndex - 1 : items.length - 1;
                this.setActiveSuggestion(items, activeIndex);
                break;
            case "Enter":
                e.preventDefault();
                if (activeIndex !== -1) items[activeIndex].click();
                break;
            case "Escape":
                this.hideSuggestions();
                break;
        }
    }
    setActiveSuggestion(items, index) {
        items.forEach(item => item.classList.remove("active"));
        items[index].classList.add("active");
        items[index].scrollIntoView({ block: "nearest" });
    }
    debounce(func, delay) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }
    destroy() {
        const { inputElement } = this.config;
        if (inputElement) {
            inputElement.removeEventListener("input", this.debouncedFilter);
            inputElement.removeEventListener("focus", this.handleFocus);
            inputElement.removeEventListener("keydown", this.handleKeyboard);
            delete inputElement.autoCompleteInstance;
        }
        document.removeEventListener("click", this.clickOutsideHandler, true);
    }
}

class PanelManager {
    constructor() {
        this.currentOpenPanels = [];
        this.elements = {
            panelBackdrop: document.getElementById("panel-backdrop"),
            panelBackdropRaycast: document.getElementById("panel-backdrop-raycast")
        };
        this.handleHashChange = e => {
            const hasPanelHash = e.newURL.includes("#panel-");
            if (this.currentOpenPanels.length > 0 && !hasPanelHash) {
                e.preventDefault();
                this.closeLastOpenPanel();
            }
        };
        this.handleEscapeKey = e => {
            if (e.key === "Escape" && this.currentOpenPanels.length > 0) {
                e.preventDefault();
                this.closeLastOpenPanel();
            }
        };
        window.addEventListener("hashchange", this.handleHashChange, true);
        document.addEventListener("keydown", this.handleEscapeKey, true);
    }
    openPanel(panelId) {
        const panel = document.querySelector(`[data-panel="${panelId}"]`);
        panel.classList.remove("display-none");
        panel.parentElement.classList.add("show");
        panel.scrollTop = 0;
        this.elements.panelBackdrop.classList.add("show");
        document.body.style.overflow = "hidden";
        this.currentOpenPanels.push(panelId);
        const randomHash = `#${new Date().getTime().toString().slice(5)}`;
        const newUrl = window.location.href.split("#")[0] + randomHash;
        history.pushState({ panelId }, "", newUrl);
    }
    closePanel(panelId) {
        const panel = document.querySelector(`[data-panel="${panelId}"]`);
        panel.parentElement.classList.remove("show");
        setTimeout(() => {
            panel.classList.add("display-none");
        }, 300);
        this.currentOpenPanels = this.currentOpenPanels.filter(id => id !== panelId);
        if (this.currentOpenPanels.length === 0) {
            this.elements.panelBackdrop.classList.remove("show");
            document.body.style.overflow = "";
            const cleanUrl = window.location.href.split("#")[0];
            history.replaceState(null, "", cleanUrl);
        } else {
            this.elements.panelBackdrop.classList.add("show");
        }
    }
    closeLastOpenPanel() {
        const lastPanel = this.currentOpenPanels.at(-1);
        if (lastPanel) this.closePanel(lastPanel);
    }
    closeAllPanels() {
        this.currentOpenPanels.forEach(id => this.closePanel(id));
    }
    destroy() {
        window.removeEventListener("hashchange", this.handleHashChange, true);
        document.removeEventListener("keydown", this.handleEscapeKey, true);
    }
}

class MyFoodApp {
    constructor() {
        this.STORAGE_KEYS = {
            MEALLOGS: "foodDiaryMeals",
            FAVSTORES: "foodDiaryRestaurants",
            POPULAR_ITEMS: "foodDiaryPopularItems"
        };
        this.dom = {
            moreMenu: {
                trigger: document.getElementById("more-menu-trigger"),
                expandMenu: document.getElementById("moreMenu"),
                backdrop: document.getElementById("moreMenu-backdrop"),
                themeSelectMenuItems: document.querySelectorAll("#theme-select-menu [data-theme]"),
                themeStylesheet: document.getElementById("colour-palette")
            },
            filter: {
                toggle: document.getElementById("filter-toggle"),
                dropdown: document.querySelector('[data-type="dropdown"]'),
                date: {
                    render: document.getElementById("filter-date-range-render"),
                    range: document.getElementById("filter-date-range"),
                    fp: null
                },
                reset: document.getElementById("filter-reset"),
                apply: document.getElementById("filter-apply")
            },
            exportImport: {
                exportBtn: document.getElementById("export-data"),
                importBtn: document.getElementById("import-data"),
                fileInput: document.getElementById("import-file"),
                deleteAll: document.getElementById("delete-data")
            },
            mealLogs: {
                list: document.getElementById("mealLogs-list"),
                prompt: document.getElementById("mealLogs-prompt"),
                detail_panel: {
                    id: "detail-mealLogs",
                    obj: document.querySelector('[data-panel="detail-mealLogs"]'),
                    image: document.querySelector('[data-panel="detail-mealLogs"] img'),
                    title: document.querySelector('[data-panel="detail-mealLogs"] h2'),
                    date: document.getElementById("detail-date"),
                    cost: document.getElementById("detail-cost"),
                    mealList: document.getElementById("detail-menu-items"),
                    close: document.getElementById("detail-close"),
                    actions: {
                        copy: document.getElementById("detail-copy-btn"),
                        edit: document.getElementById("detail-edit-btn"),
                        delete: document.getElementById("detail-delete-btn")
                    }
                },
                add_panel: {
                    id: "add-mealLogs",
                    open: document.getElementById("open-mealLogs-panel"),
                    obj: document.querySelector('[data-panel="add-mealLogs"]'),
                    h2: document.querySelector('[data-panel="add-mealLogs"] h2'),
                    form: document.querySelector('[data-panel="add-mealLogs"] form'),
                    image: {
                        preview: document.getElementById("image-preview"),
                        uploadInput: document.getElementById("eaten-image-upload"),
                        urlInput: document.getElementById("image-url"),
                        loadUrlBtn: document.getElementById("load-image-url"),
                        useDriveBtn: document.getElementById("convert-drive-url"),
                        canvas: document.getElementById("canvasGenerator"),
                        ctx: document.getElementById("canvasGenerator").getContext("2d")
                    },
                    restaurant: {
                        name: document.getElementById("eaten-restaurant-name"),
                        nameACS: document.getElementById("eaten-restaurant-acs"),
                        branch: document.getElementById("eaten-restaurant-branch"),
                        branchACS: document.getElementById("eaten-branch-acs")
                    },
                    date: {
                        render: document.getElementById("eaten-date-render"),
                        input: document.getElementById("eaten-date"),
                        fp: null
                    },
                    recommendationList: document.querySelector('[data-panel="add-mealLogs"] ul[data-type="eaten-recommendations-list"]'),
                    eatenList: document.querySelector('[data-panel="add-mealLogs"] ul[data-type="eaten-list"]'),
                    addEatenListItemBtn: document.querySelector('[data-panel="add-mealLogs"] .add-eaten-item'),
                    eatenSum: document.getElementById("eaten-sum"),
                    editMealId: document.getElementById("edit-meal-id"),
                    close: document.getElementById("form-close"),
                    save: document.querySelector('[data-panel="add-mealLogs"] .form-submit')
                }
            },
            favStores: {
                list: document.getElementById("favStores-list"),
                prompt: document.getElementById("favStores-prompt"),
                add_panel: {
                    id: "add-favStores",
                    open: document.getElementById("open-favStores-panel"),
                    obj: document.querySelector('[data-panel="add-favStores"]'),
                    form: document.querySelector('[data-panel="add-favStores"] form'),
                    restaurant: {
                        name: document.getElementById("fav-restaurant-name"),
                        branch: document.getElementById("fav-restaurant-branch")
                    },
                    address: document.getElementById("fav-address"),
                    recommendationList: document.querySelector('[data-panel="add-favStores"] ul[data-type="eaten-recommendations-list"]'),
                    favList: document.querySelector('[data-panel="add-favStores"] ul[data-type="eaten-list"]'),
                    addFavListItemBtn: document.querySelector('[data-panel="add-favStores"] .add-eaten-item')
                }
            }
        };
        this.state = {
            mealLogs: [],
            filteredMealLogs: [],
            favStores: [],
            popularItems: {},
            currentMealId: "",
            tempMealList: []
        };
        this.dropdown = new Dropdown();
        this.autoCompleteInstances = {};
        this.debounceTimers = {};
        this.dataManager = null;
        this.panelInstance = new PanelManager();
        this.init();
    }
    init() {
        this.initDataManagement();
        this.updateFilterDropdown();
        this.initAutoComplete();
        this.bindEvents();
        window.removeEatenListItem = this.removeEatenListItem.bind(this);
        const defaultTheme = localStorage.getItem("selectedTheme") || "default";
        document.querySelector(`[data-theme="${defaultTheme}"]`).click();
    }
    initDataManagement() {
        try {
            this.dataManager = new DataManagement({
                storageKeys: this.STORAGE_KEYS,
                state: this.state,
                loadData: this.loadData.bind(this),
                renderMealLogs: this.renderMealLogs.bind(this),
                renderFavStores: this.renderFavStores.bind(this),
                updatePopularItemsFromLogs: this.updatePopularItemsFromLogs.bind(this),
                initAutoComplete: this.initAutoComplete.bind(this),
                updateFilterDropdown: this.updateFilterDropdown.bind(this),
                domElements: {
                    exportBtn: this.dom.exportImport.exportBtn,
                    importBtn: this.dom.exportImport.importBtn,
                    fileInput: this.dom.exportImport.fileInput,
                    deleteAll: this.dom.exportImport.deleteAll
                }
            });
            this.loadData();
        } catch (err) {
            console.error("DataManagement 初始化失敗：", err);
            window.showToast("匯出匯入功能初始化失敗，請檢查配置");
        }
    }
    debounce(func, key, delay = 150) {
        return (...args) => {
            if (this.debounceTimers[key]) clearTimeout(this.debounceTimers[key]);
            this.debounceTimers[key] = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    }
    initAutoComplete() {
        const getFavNames = () => new Set(this.state.favStores.map(store => store.name.trim()));
        this.autoCompleteInstances.mealRestaurant = new AutoComplete({
            inputElement: this.dom.mealLogs.add_panel.restaurant.name,
            suggestionsContainer: this.dom.mealLogs.add_panel.restaurant.nameACS,
            dataSource: () => {
                const nameScores = {};
                const branchScores = {};
                const favNames = getFavNames();
                this.state.favStores.forEach(store => {
                    const name = store.name.trim();
                    branchScores[name] = (branchScores[name] || 0) + 2;
                });
                this.state.mealLogs.forEach(log => {
                    const name = log.restaurant.trim();
                    nameScores[name] = (nameScores[name] || 0) + 1;
                    branchScores[name] = (branchScores[name] || 0) + 1;
                });
                return Object.entries(branchScores).map(([name, score]) => ({
                    name,
                    count: nameScores[name] || 0,
                    score,
                    isfavourite: favNames.has(name)
                })).sort((a, b) => b.score - a.score || window.compareBpmf(a.name, b.name));
            },
            filterKey: "name",
            displayTemplate: item => `
                ${item.name}
                ${item.isfavourite ? '<span class="favourite-badge"><span class="material-symbols-rounded">star</span></span>' : ''}
                <span class="count-badge">${item.count} 次</span>
            `,
            onSelect: (value) => {
                this.dom.mealLogs.add_panel.restaurant.branch.value = "";
                this.dom.mealLogs.add_panel.restaurant.branch.focus();
                this.renderMenuRecommendations(value);
            }
        });
        this.autoCompleteInstances.mealBranch = new AutoComplete({
            inputElement: this.dom.mealLogs.add_panel.restaurant.branch,
            suggestionsContainer: this.dom.mealLogs.add_panel.restaurant.branchACS,
            dataSource: (() => {
                const restaurantInput = this.dom.mealLogs.add_panel.restaurant.name;
                return () => {
                    const restaurantName = restaurantInput.value.trim();
                    if (!restaurantName) return [];
                    const branchScores = {};
                    const branchCounts = {};
                    this.state.favStores.filter(store => store.name.trim() === restaurantName.trim()).forEach(store => {
                        const branch = store.branch?.trim();
                        if (branch) branchScores[branch] = (branchScores[branch] || 0) + 2;
                    });
                    this.state.mealLogs.filter(log => log.restaurant.trim() === restaurantName.trim()).forEach(log => {
                        const branch = log.branch?.trim();
                        if (branch) {
                            branchCounts[branch] = (branchCounts[branch] || 0) + 1;
                            branchScores[branch] = (branchScores[branch] || 0) + 1;
                        }
                    });
                    return Object.entries(branchScores).map(([branch, score]) => ({
                        branch,
                        count: branchCounts[branch] || 0,
                        score
                    })).sort((a, b) => b.score - a.score || window.compareBpmf(a.branch, b.branch));
                };
            })(),
            filterKey: "branch",
            displayTemplate: item => `
                ${item.branch}
                <span class="count-badge">${item.count} 次</span>
            `
        });
    }
    loadData() {
        this.state.mealLogs = this.dataManager.loadFromStorageWithCompression(this.STORAGE_KEYS.MEALLOGS, []);
        this.state.filteredMealLogs = [...this.state.mealLogs];
        this.state.favStores = this.dataManager.loadFromStorageWithCompression(this.STORAGE_KEYS.FAVSTORES, []);
        this.state.popularItems = this.dataManager.loadFromStorageWithCompression(this.STORAGE_KEYS.POPULAR_ITEMS, {});
        this.sortMealsByDate();
        this.renderMealLogs();
        this.renderFavStores();
        this.initDatePicker();
        this.createEventDots();
    }
    initDatePicker() {
        const flatpickr = window.flatpickr || { l10ns: {} };
        const zhTwLocale = {
            weekdays: {
                shorthand: ["日", "一", "二", "三", "四", "五", "六"],
                longhand: ["週日", "週一", "週二", "週三", "週四", "週五", "週六"]
            },
            months: {
                shorthand: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
                longhand: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]
            },
            rangeSeparator: " 至 ",
            weekAbbreviation: "週",
            scrollTitle: "滾動切換",
            toggleTitle: "點擊切換 12 / 24 小時時制"
        };
        flatpickr.l10ns.zh_tw = zhTwLocale;
        flatpickr.localize(flatpickr.l10ns.zh_tw);
        this.dom.mealLogs.add_panel.date.fp = flatpickr(this.dom.mealLogs.add_panel.date.input, {
            enableTime: true,
            noCalendar: false,
            minuteIncrement: 1,
            dateFormat: "Y-m-d H:i",
            time_24hr: true,
            defaultDate: new Date(),
            disableMobile: true,
            maxDate: new Date().fp_incr(1),
            disable: [new Date().fp_incr(1)],
            onChange: (selectedDates) => {
                const date = selectedDates[0];
                if (!date) return;
                const formattedDate = window.formatDate(date, true);
                const hours = String(date.getHours()).padStart(2, "0");
                const minutes = String(date.getMinutes()).padStart(2, "0");
                this.dom.mealLogs.add_panel.date.render.value = `${formattedDate}，${hours} : ${minutes}`;
            }
        });
    }
    createEventDots() {
        const logDates = this.state.mealLogs.map(log => flatpickr.formatDate(new Date(log.date), "Y-m-d"));
        const latestDate = logDates[0];
        const earliestDate = logDates[logDates.length - 1];

        this.dom.filter.date.fp = flatpickr(this.dom.filter.date.range, {
            mode: "range",
            enableTime: false,
            noCalendar: false,
            dateFormat: "Y-m-d",
            defaultDate: [earliestDate, latestDate],
            disableMobile: true,
            minDate: earliestDate,
            maxDate: new Date().fp_incr(1),
            disable: [new Date().fp_incr(1)],
            onChange: (selectedDates) => {
                const formattedDates = [];
                let prevYear, prevMonth;
                selectedDates.forEach(date => {
                    const parts = window.formatDate(date, true).split(" / ");
                    const currentYear = parts[0];
                    const currentMonth = parts[1];
                    const displayParts = [];
                    if (currentYear !== prevYear) displayParts.push(currentYear);
                    if (currentMonth !== prevMonth) displayParts.push(currentMonth);
                    displayParts.push(parts[2].split("（")[0]);
                    formattedDates.push(displayParts.join(" / "));
                    prevYear = currentYear;
                    prevMonth = currentMonth;
                });
                this.dom.filter.date.render.value = formattedDates.join(" ⸺ ");
            },
            onDayCreate: function (dp, el, dateStr, dateElem) {
                const formattedDate = flatpickr.formatDate(dateElem.dateObj, "Y-m-d");
                if (logDates.includes(formattedDate)) {
                    dateElem.innerHTML += "<span class='event'></span>";
                }
            }
        });
        this.dom.filter.date.fp.setDate([]);
    }
    sortMealsByDate() {
        this.state.mealLogs.sort((a, b) => b.date.localeCompare(a.date));
    }
    renderMealLogs() {
        this.dom.mealLogs.list.innerHTML = "";
        if (this.state.filteredMealLogs.length === 0) {
            this.dom.mealLogs.prompt.classList.remove("display-none");
            return;
        }
        this.dom.mealLogs.prompt.classList.add("display-none");
        const fragment = document.createDocumentFragment();
        this.state.filteredMealLogs.forEach((log, index) => {
            fragment.appendChild(this.createMealCard(log, index));
        });
        this.dom.mealLogs.list.appendChild(fragment);
    }
    createMealCard(log, index) {
        const li = document.createElement("li");
        li.dataset.id = log.id;
        li.style.animationDelay = 0.1 * index + "s";
        const menuTags = log.menu.map((item, itemIndex) => `
            <span class="menu-item-tag" style="animation-delay: ${0.1 + 0.05 * itemIndex}s">${item.name}</span>
        `).join("");
        li.innerHTML = `
            <div class="cover">
                <div class="badge">${log.restaurant}${log.branch ? "・" + log.branch : ""}</div>
                <img src="${log.img}" alt="${log.restaurant}">
            </div>
            <div class="body">
                <h3>
                    <span class="material-symbols-rounded">event</span>${window.formatDate(log.date)}
                </h3>
                <div class="menu-preview">${menuTags}</div>
                <div class="footer">
                    <span>${log.menu.length} 道菜</span>
                    <span class="totalCost">$ ${log.totalCost.toLocaleString()}</span>
                </div>
            </div>
        `;
        li.addEventListener("click", () => this.showMealDetail(log));
        return li;
    }
    showMealDetail(log) {
        this.state.currentMealId = log.id;
        this.dom.mealLogs.detail_panel.image.src = log.img;
        this.dom.mealLogs.detail_panel.title.innerHTML = `${log.restaurant}<sub>${log.branch || ""}</sub>`;
        this.dom.mealLogs.detail_panel.date.textContent = window.formatDate(log.date);
        this.dom.mealLogs.detail_panel.cost.textContent = `$ ${log.totalCost.toLocaleString()}`;
        this.dom.mealLogs.detail_panel.cost.style.animationDelay = 0.05 * (log.menu.length + 8) + "s";
        this.dom.mealLogs.detail_panel.mealList.innerHTML = "";
        const fragment = document.createDocumentFragment();
        log.menu.forEach((item, index) => {
            if (!item.amount) item.amount = 1;
            if (!item.note) item.note = "";
            const div = document.createElement("div");
            div.className = "menu-item";
            div.style.opacity = "0";
            div.style.transform = "translateY(10px)";
            div.style.animation = "fadeIn 0.3s ease forwards";
            div.style.animationDelay = 0.05 * (index + 8) + "s";
            div.innerHTML = `
                <span data-type="name">${item.name}<span data-type="amount">${item.amount > 1 ? item.amount : ""}</span></span>
                <span data-type="price">${(item.price * item.amount).toLocaleString()}</span>
                <span data-type="note">${item.note}</span>
            `;
            fragment.appendChild(div);
        });
        this.dom.mealLogs.detail_panel.mealList.appendChild(fragment);
        this.panelInstance.openPanel(this.dom.mealLogs.detail_panel.id);
    }
    resetMealLogsPanel() {
        const panel = this.dom.mealLogs.add_panel;
        panel.form.reset();
        panel.editMealId.value = "";
        panel.eatenList.innerHTML = "";
        this.addEatenListItem({ silent: true });
        panel.image.preview.innerHTML = '<span class="material-symbols-rounded upload-icon">add_photo_alternate</span>';
        panel.image.urlInput.value = "";
        panel.recommendationList.innerHTML = "";
        this.calcEatenListSum();
        panel.obj.querySelectorAll(".form-group.error").forEach(el => el.classList.remove("error"));
        panel.date.fp.clear();
        panel.date.fp.setDate(`${window.getLocalDatetime(true).replace("T", " ")}`, true);
        this.state.tempMealList = [];
    }
    createEatenListItem(isFavMenu = false) {
        const li = document.createElement("li");
        li.innerHTML = `
            <div class="form-group">
                <label>名稱</label>
                <input type="text" data-type="name" placeholder="菜品" required>
                <div class="form-error">請輸入菜品名稱</div>
            </div>
            <div class="form-group">
                <label>單價</label>
                <input type="number" data-type="price" step="1" placeholder="單價" required>
                <div class="form-error">請輸入單價</div>
            </div>
            <div class="form-group">
                <label>詳細備注（選填）</label>
                <input type="text" data-type="note" placeholder="備注（選填）">
            </div>
            <div class="form-group">
                <label>數量</label>
                <input type="number" data-type="amount" min="1" step="1" placeholder="數量" value="1" required>
                <div class="form-error">請輸入有效數量</div>
            </div>
            <button type="button" class="remove-eaten-item btn-danger" onclick="removeEatenListItem(this, ${isFavMenu})">
                <span class="material-symbols-rounded" style="font-size:1.25em;">delete</span>
            </button>
        `;
        li.style.opacity = "0";
        li.style.transform = "translateY(10px)";
        setTimeout(() => {
            li.style.transition = "opacity 0.3s ease, transform 0.3s ease";
            li.style.opacity = "1";
            li.style.transform = "translateY(0)";
        }, 10);
        return li;
    }
    addEatenListItem(options = {}) {
        const { isRestaurantMenu = false, silent = false } = options;
        const list = isRestaurantMenu ? this.dom.favStores.add_panel.favList : this.dom.mealLogs.add_panel.eatenList;
        if (list) {
            list.appendChild(this.createEatenListItem(isRestaurantMenu));
            if (!silent && !isRestaurantMenu) this.calcEatenListSum();
        }
    }
    removeEatenListItem(btn, isFavMenu) {
        btn.parentElement.remove();
        if (!isFavMenu) this.calcEatenListSum();
    }
    calcEatenListSum() {
        let total = 0;
        this.dom.mealLogs.add_panel.eatenList.querySelectorAll("li").forEach(li => {
            const amount = parseInt(li.querySelector('input[data-type="amount"]').value.trim() || 1);
            const price = parseInt(li.querySelector('input[data-type="price"]').value.trim() || 0);
            total += price * amount;
        });
        this.dom.mealLogs.add_panel.eatenSum.value = total.toLocaleString();
        return total;
    }
    saveMealLog() {
        const isValid = Array.from(this.dom.mealLogs.add_panel.obj.querySelectorAll("input[required]")).every(input => {
            const value = input.value.trim();
            let valid = true;
            if (input.type === "number") {
                valid = !!value && !isNaN(value);
                if (input.max) valid = valid && value <= input.max;
                if (input.min) valid = valid && value >= input.min;
            } else {
                valid = !!value;
            }
            input.closest(".form-group").classList.toggle("error", !valid);
            return valid;
        });
        if (!isValid) {
            window.showToast("表單填寫有誤，請檢查");
            return;
        }
        const editId = this.dom.mealLogs.add_panel.editMealId.value;
        const isEdit = !!editId;
        const restaurant = this.dom.mealLogs.add_panel.restaurant.name.value.trim();
        const branch = this.dom.mealLogs.add_panel.restaurant.branch.value.trim();
        const date = this.dom.mealLogs.add_panel.date.input.value + ":" + ("0" + new Date().getSeconds()).slice(-2);
        const menu = [];
        this.dom.mealLogs.add_panel.eatenList.querySelectorAll("li").forEach(li => {
            const name = li.querySelector('input[data-type="name"]').value.trim();
            const amount = parseInt(li.querySelector('input[data-type="amount"]').value.trim());
            const price = parseInt(li.querySelector('input[data-type="price"]').value.trim() || 0);
            const note = li.querySelector('input[data-type="note"]').value.trim() || "";
            menu.push({ name, price, note, amount });
        });
        if (menu.length === 0) {
            window.showToast("請至少添加 1 道菜品");
            return;
        }
        const totalCost = this.calcEatenListSum();
        let img = this.dom.mealLogs.add_panel.image.preview.firstChild?.src;
        if (!img) img = this.drawTextOnCanvas(restaurant);
        if (isEdit) {
            const index = this.state.mealLogs.findIndex(log => log.id === editId);
            if (index !== -1) {
                this.state.mealLogs[index] = {
                    ...this.state.mealLogs[index],
                    restaurant,
                    branch,
                    date,
                    menu,
                    totalCost,
                    img
                };
            }
        } else {
            this.state.mealLogs.push({
                id: window.generateId(),
                restaurant,
                branch,
                date,
                menu,
                totalCost,
                img
            });
        }
        this.sortMealsByDate();
        this.state.filteredMealLogs = [...this.state.mealLogs];
        this.applyFilter();
        this.dataManager.saveToStorageWithCompression(this.STORAGE_KEYS.MEALLOGS, this.state.mealLogs);
        this.renderMealLogs();
        this.updateFilterDropdown();
        this.createEventDots();
        this.panelInstance.closePanel(this.dom.mealLogs.add_panel.id);
        this.resetMealLogsPanel();
        window.showToast(isEdit ? "成功更新" : "成功儲存");
    }
    copyOrEditMealLog(isCopy = false) {
        const log = this.state.mealLogs.find(log => log.id === this.state.currentMealId);
        const panel = this.dom.mealLogs.add_panel;
        panel.editMealId.value = isCopy ? "" : this.state.currentMealId;
        panel.h2.textContent = (isCopy ? "複製" : "編輯") + "用餐紀錄";
        panel.restaurant.name.value = log.restaurant;
        panel.restaurant.branch.value = log.branch;
        panel.date.fp.setDate(isCopy ? window.getLocalDatetime(true) : log.date, true);
        this.fillMenuItems(log.menu);
        this.displayImage(log.img);
        panel.image.urlInput.value = log.img;
        this.calcEatenListSum();
        this.panelInstance.closePanel(this.dom.mealLogs.detail_panel.id);
        setTimeout(() => {
            this.panelInstance.openPanel(panel.id);
        }, 300);
        this.state.currentMealId = null;
    }
    fillMenuItems(menuItems, isFavMenu = false) {
        const list = isFavMenu ? this.dom.favStores.add_panel.favList : this.dom.mealLogs.add_panel.eatenList;
        list.innerHTML = "";
        menuItems.forEach((item, index) => {
            this.addEatenListItem({ isRestaurantMenu: isFavMenu, silent: true });
            const li = list.lastChild;
            ["name", "price", "note", "amount"].forEach(key => {
                const input = li.querySelector(`input[data-type="${key}"]`);
                let value = item[key];
                switch (key) {
                    case "note":
                        value = value || "";
                        break;
                    case "amount":
                        value = value || 1;
                        break;
                    case "price":
                        value = value || 0;
                        break;
                }
                input.value = value;
            });
        });
    }
    renderFavStores() {
        this.dom.favStores.list.innerHTML = "";
        // if (this.state.favStores.length === 0) {
        this.dom.favStores.prompt.classList.remove("display-none");
        // return;
        // }
        // this.dom.favStores.prompt.classList.add("display-none");
        // const fragment = document.createDocumentFragment();
        // this.state.favStores.sort((a, b) => window.compareBpmf(a.name, b.name)).forEach(store => {
        //     const li = document.createElement("li");
        //     li.innerHTML = `
        //         <h3>${store.name}${store.branch ? "・" + store.branch : ""}</h3>
        //         ${store.address ? `<p class="address">${store.address}</p>` : ""}
        //         <div class="menu-preview">
        //             ${store.menu?.map(item => `<span class="menu-item-tag">${item.name}</span>`).join("") || ""}
        //         </div>
        //     `;
        //     fragment.appendChild(li);
        // });
        // this.dom.favStores.list.appendChild(fragment);
    }
    updatePopularItemsFromLogs() {
        const popular = {};
        this.state.mealLogs.forEach(log => {
            log.menu?.forEach(item => {
                const name = item.name?.trim();
                if (name) {
                    if (popular[name]) {
                        popular[name].count += 1;
                        popular[name].avgPrice = Math.round((popular[name].avgPrice * (popular[name].count - 1) + (item.price || 0)) / popular[name].count);
                    } else {
                        popular[name] = { count: 1, avgPrice: item.price || 0, note: item.note || "" };
                    }
                }
            });
        });
        this.state.popularItems = popular;
        this.dataManager.saveToStorageWithCompression(this.STORAGE_KEYS.POPULAR_ITEMS, popular);
    }
    updateFilterDropdown() {
        const listEl = document.querySelector('#filter-section ul[data-type="dropdown"]');
        this.dropdown.update(listEl, ["所有餐廳"], false);
        const uniqueNames = Array.from(new Set([
            ...this.state.favStores.map(store => store.name),
            ...this.state.mealLogs.map(log => log.restaurant)
        ]));
        this.dropdown.update(listEl, uniqueNames);
    }
    applyFilter() {
        const selectedRestaurant = this.dom.filter.dropdown.querySelector("li.selected")?.textContent;
        const filterRestaurant = selectedRestaurant === "所有餐廳" ? "" : selectedRestaurant;
        const startDate = this.dom.filter.date.fp.selectedDates[0];
        const endDate = this.dom.filter.date.fp.selectedDates[1];
        this.state.filteredMealLogs = this.state.mealLogs.filter(log => {
            const logDate = new Date(log.date);
            const matchRestaurant = !filterRestaurant || log.restaurant === filterRestaurant;
            const matchStart = !startDate || logDate >= startDate;
            const matchEnd = !endDate || logDate <= endDate;
            return matchRestaurant && matchStart && matchEnd;
        });
        this.state.filteredMealLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
        this.renderMealLogs();
    }
    drawTextOnCanvas(text) {
        const canvasWidth = 711;
        const canvasHeight = 400;
        const ctx = this.dom.mealLogs.add_panel.image.ctx;
        const canvas = this.dom.mealLogs.add_panel.image.canvas;
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        const colorConfig = {
            lightBgTextColors: ["#1a202c", "#2d3748", "#4a5568", "#2b6cb0", "#2f855a", "#9f7aea", "#c53030", "#d69e2e"],
            darkBgTextColors: ["#f7fafc", "#edf2f7", "#e8f4f8", "#f0f8fb", "#f5fafe", "#fdf2f8", "#faf6ed", "#eaf6fa"]
        };
        const hexToRgb = hex => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        };
        const getLuminance = rgb => {
            const normalized = [rgb.r, rgb.g, rgb.b].map(val => {
                const norm = val / 255;
                return norm <= 0.03928 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
            });
            return 0.2126 * normalized[0] + 0.7152 * normalized[1] + 0.0722 * normalized[2];
        };
        const generateRandomHex = () => {
            let hex = "";
            const chars = "0123456789ABCDEF";
            for (let i = 0; i < 6; i++) {
                hex += chars[Math.floor(Math.random() * 16)];
            }
            return hex;
        };
        const getContrastTextColor = bgHex => {
            const bgRgb = hexToRgb(`#${bgHex}`);
            const bgLuminance = getLuminance(bgRgb);
            const baseColors = bgLuminance > 0.5 ? colorConfig.lightBgTextColors : colorConfig.darkBgTextColors;
            const highContrast = baseColors.filter(textHex => {
                const textRgb = hexToRgb(textHex);
                const textLuminance = getLuminance(textRgb);
                const ratio = (Math.max(bgLuminance, textLuminance) + 0.05) / (Math.min(bgLuminance, textLuminance) + 0.05);
                return ratio >= 4.5;
            });
            return highContrast.length > 0 ? highContrast[Math.floor(Math.random() * highContrast.length)] : bgLuminance > 0.5 ? "#000" : "#fff";
        };
        const bgHex = generateRandomHex();
        const textColor = getContrastTextColor(bgHex);
        ctx.fillStyle = `#${bgHex}`;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        const textLines = text.split("\n").filter(line => line.trim() !== "");
        const displayLines = textLines.length > 0 ? textLines : ["*餐點照片*"];
        ctx.fillStyle = textColor;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = '60px "NotoSans", "ZutekSans", sans-serif';
        ctx.shadowColor = "rgba(0, 0, 0, 0.15)";
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        const lineHeight = 75;
        const totalTextHeight = lineHeight * displayLines.length;
        const startY = (canvasHeight - totalTextHeight) / 2 + lineHeight / 2;
        displayLines.forEach(line => {
            let fontSize = 60;
            while (ctx.measureText(line).width > canvasWidth - 56.65 && fontSize > 16) {
                fontSize--;
                ctx.font = `${fontSize}px "NotoSans", "ZutekSans", sans-serif`;
            }
        });
        displayLines.forEach((line, index) => {
            const y = startY + lineHeight * index;
            ctx.fillText(line, canvasWidth / 2, y);
        });
        ctx.shadowColor = "transparent";
        return canvas.toDataURL("image/png");
    }
    displayImage(imageUrl) {
        const preview = this.dom.mealLogs.add_panel.image.preview;
        preview.innerHTML = "";
        const img = document.createElement("img");
        img.src = imageUrl;
        img.alt = "餐點照片";
        img.onerror = () => {
            preview.innerHTML = '<span class="material-symbols-rounded upload-icon">error</span>';
            window.showToast("圖片載入失敗，請更換圖片或 URL");
            this.state.currentImageData = null;
        };
        img.onload = () => {
            this.dom.mealLogs.add_panel.image.urlInput.value = imageUrl;
        };
        preview.appendChild(img);
    }
    renderMenuRecommendations(restaurantName) {
        const list = this.dom.mealLogs.add_panel.recommendationList;
        list.innerHTML = "";
        const menuMap = {};
        this.state.mealLogs.forEach(log => {
            if (log.restaurant.trim() === restaurantName.trim()) {
                log.menu.forEach(item => {
                    const name = item.name.trim();
                    if (name) {
                        if (menuMap[name]) {
                            menuMap[name].count += 1;
                            menuMap[name].avgPrice = Math.round((menuMap[name].avgPrice * (menuMap[name].count - 1) + (item.price || 0)) / menuMap[name].count);
                        } else {
                            menuMap[name] = {
                                name,
                                count: 1,
                                avgPrice: item.price || 0,
                                note: item.note || ""
                            };
                        }
                    }
                });
            }
        });
        const recommendations = Object.values(menuMap).sort((a, b) => b.count - a.count || window.compareBpmf(a.name, b.name));
        if (recommendations.length === 0) {
            list.innerHTML = '<li class="no-recommendation">暫無推薦內容，快開發新餐廳吧！</li>';
            return;
        }
        const fragment = document.createDocumentFragment();
        recommendations.forEach(item => {
            const li = document.createElement("li");
            li.innerHTML = `
                <span class="menu-name">${item.name}</span>
                <span class="menu-meta">$ ${item.avgPrice.toLocaleString()}，${item.count} 次</span>`;
            li.addEventListener("click", () => {
                this.addEatenListItem({ silent: true });
                const lastLi = this.dom.mealLogs.add_panel.eatenList.lastChild;
                lastLi.querySelector('input[data-type="name"]').value = item.name;
                lastLi.querySelector('input[data-type="price"]').value = item.avgPrice;
                lastLi.querySelector('input[data-type="note"]').value = item.note;
                this.calcEatenListSum();
            });
            fragment.appendChild(li);
        });
        list.appendChild(fragment);
    }
    bindEvents() {
        document.querySelectorAll(".tab-item").forEach(tab => {
            tab.addEventListener("click", function () {
                document.querySelectorAll(".tab-item").forEach(item => item.classList.remove("active"));
                this.classList.add("active");
                const tabType = this.dataset.tab;
                const mealLogsSection = document.getElementById("mealLogs-record").parentElement;
                const favStoresSection = document.getElementById("favStores-records").parentElement;
                if (mealLogsSection && favStoresSection) {
                    const showMealLogs = tabType === "mealList";
                    mealLogsSection.classList.toggle("display-none", !showMealLogs);
                    favStoresSection.classList.toggle("display-none", showMealLogs);
                }
            });
        });
        this.dom.moreMenu.trigger.addEventListener("click", () => {
            this.dom.moreMenu.expandMenu.classList.toggle("open");
            this.dom.moreMenu.backdrop.classList.toggle("show");
        });
        this.dom.moreMenu.backdrop.addEventListener("click", () => {
            this.dom.moreMenu.expandMenu.classList.remove("open");
            this.dom.moreMenu.backdrop.classList.remove("show");
        });
        this.dom.moreMenu.themeSelectMenuItems.forEach(item => {
            item.addEventListener("click", e => {
                const theme = e.target.dataset.theme;
                localStorage.setItem("selectedTheme", theme);
                this.dom.moreMenu.themeSelectMenuItems.forEach(i => i.classList.remove("selected"));
                e.target.classList.add("selected");
                this.dom.moreMenu.themeStylesheet.setAttribute("href", `palette_${theme}.css`);
            });
        });
        this.dom.filter.toggle.addEventListener("click", () => {
            this.dom.filter.toggle.parentElement.classList.toggle("expanded");
        });
        this.dom.filter.date.render.addEventListener("click", () => {
            this.dom.filter.date.range.click();
        });
        this.dom.filter.apply.addEventListener("click", () => {
            this.applyFilter();
        });
        this.dom.filter.reset.addEventListener("click", () => {
            this.dom.filter.dropdown.firstChild.click();
            this.dom.filter.date.fp.setDate([], true);
            this.applyFilter();
        });
        this.panelInstance.elements.panelBackdropRaycast.addEventListener("click", () => {
            this.panelInstance.closeAllPanels();
        });
        this.dom.mealLogs.detail_panel.close.addEventListener("click", () => {
            this.panelInstance.closePanel(this.dom.mealLogs.detail_panel.id);
        });
        this.dom.mealLogs.detail_panel.actions.copy.addEventListener("click", () => {
            this.copyOrEditMealLog(true);
        });
        this.dom.mealLogs.detail_panel.actions.edit.addEventListener("click", () => {
            this.copyOrEditMealLog(false);
        });
        this.dom.mealLogs.detail_panel.actions.delete.addEventListener("click", () => {
            if (confirm("確定刪除？")) {
                this.state.mealLogs = this.state.mealLogs.filter(log => log.id !== this.state.currentMealId);
                this.state.filteredMealLogs = this.state.filteredMealLogs.filter(log => log.id !== this.state.currentMealId);
                this.dataManager.saveToStorageWithCompression(this.STORAGE_KEYS.MEALLOGS, this.state.mealLogs);
                this.updatePopularItemsFromLogs();
                this.renderMealLogs();
                this.createEventDots();
                window.showToast("成功刪除");
                this.panelInstance.closePanel(this.dom.mealLogs.detail_panel.id);
            }
        });
        this.dom.mealLogs.add_panel.close.addEventListener("click", () => {
            this.panelInstance.closePanel(this.dom.mealLogs.add_panel.id);
        });
        this.dom.mealLogs.add_panel.date.render.addEventListener("click", () => {
            this.dom.mealLogs.add_panel.date.input.click();
        });
        this.dom.mealLogs.add_panel.open.addEventListener("click", () => {
            this.dom.mealLogs.add_panel.h2.textContent = "新增用餐紀錄";
            this.resetMealLogsPanel();
            this.panelInstance.openPanel(this.dom.mealLogs.add_panel.id);
        });
        this.dom.mealLogs.add_panel.eatenList.addEventListener("input", e => {
            if (e.target.dataset.type === "price" || e.target.dataset.type === "amount") {
                this.calcEatenListSum();
            }
        });
        this.dom.mealLogs.add_panel.addEatenListItemBtn.addEventListener("click", () => {
            this.addEatenListItem();
        });
        this.dom.mealLogs.add_panel.save.addEventListener("click", () => {
            this.saveMealLog();
        });
        this.dom.mealLogs.add_panel.image.uploadInput.addEventListener("change", e => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = loadEvent => {
                    this.displayImage(loadEvent.target.result);
                };
                reader.readAsDataURL(file);
            }
        });
        this.dom.mealLogs.add_panel.image.preview.addEventListener("click", () => {
            this.dom.mealLogs.add_panel.image.uploadInput.click();
        });
        this.dom.mealLogs.add_panel.image.loadUrlBtn.addEventListener("click", () => {
            const url = this.dom.mealLogs.add_panel.image.urlInput.value.trim();
            if (!url) {
                window.showToast("請輸入圖片 URL");
                return;
            }
            if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("data:image/png;base64,")) {
                window.showToast("請輸入有效的圖片 URL");
                return;
            }
            this.displayImage(url);
        });
        this.dom.mealLogs.add_panel.image.useDriveBtn.addEventListener("click", () => {
            const driveUrl = this.dom.mealLogs.add_panel.image.urlInput.value.trim();
            if (!driveUrl) {
                window.showToast("請輸入圖片 URL");
                return;
            }
            const fileIdMatch = driveUrl.split("?")[0].match(/\/d\/([^\/]+)/);
            if (!fileIdMatch || !fileIdMatch[1]) {
                window.showToast("請輸入有效的 Google Drive 圖片 URL");
                return;
            }
            const directUrl = `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}`;
            this.displayImage(directUrl);
        });
        this.dom.favStores.add_panel.open.addEventListener("click", () => {
            window.showToast("敬請期待");
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    window.bpmfCollator = new Intl.Collator("zh-Hant", { collation: "zhuyin" });
    window.compareBpmf = (a, b) => window.bpmfCollator.compare(a, b);
    window.getLocalDatetime = (withTime = false) => {
        const date = new Date();
        const padZero = (num, length = 2) => String(num).padStart(length, "0");
        const year = date.getFullYear();
        const month = padZero(date.getMonth() + 1);
        const day = padZero(date.getDate());
        if (!withTime) return `${year}-${month}-${day}`;
        const hours = padZero(date.getHours());
        const minutes = padZero(date.getMinutes());
        const seconds = padZero(date.getSeconds());
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    };
    window.formatDate = (date, hideWeekday = false) => {
        const localDate = new Date(date);
        const formatted = localDate.toLocaleDateString("zh-TW", {
            year: "numeric",
            month: "numeric",
            day: "2-digit",
            weekday: "short"
        }).split("/");
        formatted[0] -= 1911;
        if (hideWeekday) formatted[2] = formatted[2].split("（")[0];
        return formatted.join(" / ");
    };
    window.showToast = (message) => {
        const toast = document.createElement("div");
        toast.className = "toast-notification";
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add("show"), 10);
        setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };
    window.generateId = () => {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    };
    new MyFoodApp();
});
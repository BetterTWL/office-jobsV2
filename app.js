document.addEventListener("DOMContentLoaded", () => {
    // 1. Initial setups
    const timeSpan = document.getElementById("current-time");
    if (timeSpan) {
        const updateTime = () => {
            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            const hh = String(now.getHours()).padStart(2, '0');
            const min = String(now.getMinutes()).padStart(2, '0');
            timeSpan.textContent = `${yyyy}-${mm}-${dd} ${hh}:${min}`;
        };
        updateTime();
        setInterval(updateTime, 60000);
    }

    // Initialize lucide icons helper
    const initIcons = () => {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    };
    initIcons();

    // Theme Toggle Logic
    const themeToggleBtn = document.getElementById("theme-toggle-btn");
    const themeIcon = document.getElementById("theme-icon");
    
    const applyTheme = (theme) => {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("theme", theme);
        
        // Update Lucide Icon dynamically
        if (themeIcon) {
            themeIcon.setAttribute("data-lucide", theme === "dark" ? "sun" : "moon");
            initIcons();
        }
        
        // Update Radar Chart colors if initialized
        if (radarChart) {
            const isDark = theme === "dark";
            radarChart.options.scales.r.pointLabels.color = isDark ? "#cbd5e1" : "#334155";
            radarChart.options.scales.r.grid.color = isDark ? "#334155" : "#cbd5e1";
            radarChart.options.scales.r.angleLines.color = isDark ? "#334155" : "#cbd5e1";
            radarChart.options.scales.r.ticks.color = isDark ? "#94a3b8" : "#64748b";
            radarChart.update();
        }
    };
    
    // Check initial preference
    const initialTheme = localStorage.getItem("theme") || 
        (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    applyTheme(initialTheme);
    
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener("click", () => {
            const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
            const newTheme = currentTheme === "dark" ? "light" : "dark";
            applyTheme(newTheme);
        });
    }

    // 2. Load and categorize roles
    const jobs = window.JOBS_DATA || [];
    console.log("Loaded jobs:", jobs.length);

    // Categories mapping helper
    const classifyJob = (jobName) => {
        const name = jobName.toLowerCase();
        if (name.includes("mis") || name.includes("資訊") || name.includes("韌體") || name.includes("機構") || name.includes("生技") || name.includes("維修")) {
            return "tech";
        } else if (name.includes("smt") || name.includes("製造") || name.includes("生產") || name.includes("生管")) {
            return "manufacturing";
        } else if (name.includes("人資") || name.includes("總務") || name.includes("廠務") || name.includes("財會") || name.includes("會計") || name.includes("財務") || name.includes("倉管")) {
            return "admin";
        } else if (name.includes("採購") || name.includes("業務")) {
            return "sales";
        }
        return "admin"; // default
    };

    let activeJob = jobs[0] || null;
    let evalScores = {}; // Stores self-evaluation scores for active job: { itemId: score }
    let radarChart = null;

    // Elements
    const roleListContainer = document.getElementById("role-list-container");
    const roleSearchInput = document.getElementById("role-search");
    const filterButtons = document.querySelectorAll(".filter-btn");
    const tabButtons = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");
    const currentRoleTitle = document.getElementById("current-role-title");
    
    // Default mock salary structure for roles without salary data (like 生技維修)
    const generateDefaultSalary = (jobName) => {
        return [
            { grade: "L3A", title_zh: "助理技術員", title_en: "Junior Technician", salary_min: "30000", salary_mid: "33000", salary_max: "36000", requirements: "認真負責、配合度高，並能配合資深師傅完成指派工作項目", promotion: "通過OJT考評", amoeba: "學習者" },
            { grade: "L3B", title_zh: "技術員", title_en: "Technician", salary_min: "33000", salary_mid: "36000", salary_max: "40000", requirements: "熟練單一工站操作、防呆識別、報工程序與5S規範執行", promotion: "獨立作業，無不良異常記錄", amoeba: "執行者" },
            { grade: "L4A", title_zh: "工程師", title_en: "Engineer", salary_min: "38000", salary_mid: "43000", salary_max: "49000", requirements: "熟練多工站操作或設備調機、製程異常處置、巡檢表填寫、具基礎8D知識", promotion: "多工站輪訓達標，設備異常修復率符合標準", amoeba: "獨立執行者" },
            { grade: "L4B", title_zh: "資深工程師", title_en: "Senior Engineer", salary_min: "44000", salary_mid: "50000", salary_max: "57000", requirements: "主導設備保養與維修計畫、異常原因分析與改善提案、品質異常追查、備料及安全管理", promotion: "提案改善通過並具效益，年度考評優良", amoeba: "獨立執行者" },
            { grade: "L5A", title_zh: "技術主管", title_en: "Technical Lead", salary_min: "52000", salary_mid: "59000", salary_max: "68000", requirements: "建立保養/維護SOP、規劃年度備件預算、帶領新人培訓、主導品質稽核應對與改善", promotion: "具備帶訓師資格，獨立主導改善案件", amoeba: "巴長儲備人選" }
        ];
    };

    // 3. Render sidebar roles
    const renderSidebar = (searchQuery = "", filterCategory = "all") => {
        roleListContainer.innerHTML = "";
        
        const filtered = jobs.filter(job => {
            const matchesSearch = job.job_name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = filterCategory === "all" || classifyJob(job.job_name) === filterCategory;
            return matchesSearch && matchesCategory;
        });

        if (filtered.length === 0) {
            roleListContainer.innerHTML = `<div class="empty-state" style="height:120px;color:rgba(255,255,255,0.4);"><p>查無符合的職缺</p></div>`;
            return;
        }

        filtered.forEach(job => {
            const item = document.createElement("button");
            item.className = `role-item ${activeJob && activeJob.filename === job.filename ? 'active' : ''}`;
            
            // Generate category badge
            const cat = classifyJob(job.job_name);
            let catZh = "技術";
            if (cat === "tech") catZh = "研發技術";
            else if (cat === "manufacturing") catZh = "生產製造";
            else if (cat === "admin") catZh = "行政管理";
            else if (cat === "sales") catZh = "商務開發";

            item.innerHTML = `
                <div class="role-info">
                    <h3>${job.job_name}</h3>
                    <span>${job.competencies.length} 項能力指標</span>
                </div>
                <span class="role-badge">${catZh}</span>
            `;

            item.addEventListener("click", () => {
                activeJob = job;
                document.querySelectorAll(".role-item").forEach(el => el.classList.remove("active"));
                item.classList.add("active");
                loadActiveJobData();
            });

            roleListContainer.appendChild(item);
        });
    };

    // Search and filter listeners
    roleSearchInput.addEventListener("input", (e) => {
        const activeFilter = document.querySelector(".filter-btn.active").dataset.filter;
        renderSidebar(e.target.value, activeFilter);
    });

    filterButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            filterButtons.forEach(el => el.classList.remove("active"));
            btn.classList.add("active");
            renderSidebar(roleSearchInput.value, btn.dataset.filter);
        });
    });

    // 4. Tab switching logic
    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            tabButtons.forEach(el => el.classList.remove("active"));
            tabContents.forEach(el => el.classList.remove("active"));

            btn.classList.add("active");
            const tabId = `tab-${btn.dataset.tab}`;
            const targetContent = document.getElementById(tabId);
            if (targetContent) {
                targetContent.classList.add("active");
            }
            
            // Re-render chart if switching to self-eval tab
            if (btn.dataset.tab === "self-eval") {
                updateRadarChart();
            }
        });
    });

    // 5. Load Active Job Content
    const loadActiveJobData = () => {
        if (!activeJob) return;
        
        currentRoleTitle.textContent = activeJob.job_name;

        // Reset evaluation scores
        evalScores = {};
        activeJob.competencies.forEach(c => {
            evalScores[c.code] = 0; // Default to 0
        });

        renderSalaryTab();
        renderMatrixTab();
        renderSelfEvalTab();
        renderInterviewTab();
        
        // Return tab buttons to the first tab (Salary) when changing jobs
        const salaryTabBtn = document.querySelector('.tab-btn[data-tab="salary"]');
        if (salaryTabBtn) salaryTabBtn.click();
    };

    // TAB 1: SALARY RENDER
    const renderSalaryTab = () => {
        const container = document.getElementById("salary-range-bars-container");
        const detailsContainer = document.getElementById("salary-detail-content");
        container.innerHTML = "";
        detailsContainer.innerHTML = `
            <div class="empty-state">
                <i data-lucide="mouse-pointer-click"></i>
                <p>請點擊左側薪資圖表中的職等，以檢視其詳細核心要求與晉升標準。</p>
            </div>
        `;
        initIcons();

        // Get salary structure or fallback to default
        let salaryData = activeJob.salary_structure || [];
        let isFallback = false;
        if (salaryData.length === 0) {
            salaryData = generateDefaultSalary(activeJob.job_name);
            isFallback = true;
        }

        // Calculate maximum top salary to normalize the width
        let maxSalaryVal = 0;
        salaryData.forEach(item => {
            const val = parseInt(item.salary_max) || 0;
            if (val > maxSalaryVal) maxSalaryVal = val;
        });

        // Fallback max check
        if (maxSalaryVal === 0) maxSalaryVal = 100000;

        // Render bars
        salaryData.forEach((item, index) => {
            const min = parseInt(item.salary_min) || 0;
            const max = parseInt(item.salary_max) || 0;
            
            // Calculate percentage positions for range bar
            const minPercent = (min / maxSalaryVal) * 100;
            const maxPercent = (max / maxSalaryVal) * 100;
            const widthPercent = maxPercent - minPercent;

            const barElement = document.createElement("div");
            barElement.className = `salary-bar-item ${index === 0 ? 'selected' : ''}`;
            barElement.innerHTML = `
                <div class="bar-meta">
                    <span class="grade-code">${item.grade}</span>
                    <span class="title">${item.title_zh} <small style="color:var(--text-muted);font-weight:normal;">${item.title_en}</small></span>
                </div>
                <div class="bar-track">
                    <div class="bar-fill" style="left: ${minPercent}%; width: ${widthPercent}%;"></div>
                </div>
                <div class="bar-values">
                    <span>$${min.toLocaleString()}</span>
                    <span>$${max.toLocaleString()}</span>
                </div>
            `;

            barElement.addEventListener("click", () => {
                document.querySelectorAll(".salary-bar-item").forEach(el => el.classList.remove("selected"));
                barElement.classList.add("selected");
                renderSalaryDetail(item, isFallback);
            });

            container.appendChild(barElement);
        });

        // Trigger detail rendering for the first element by default
        if (salaryData.length > 0) {
            renderSalaryDetail(salaryData[0], isFallback);
            const firstBar = container.querySelector(".salary-bar-item");
            if (firstBar) firstBar.classList.add("selected");
        }
    };

    const renderSalaryDetail = (item, isFallback) => {
        const detailsContainer = document.getElementById("salary-detail-content");
        
        const minStr = parseInt(item.salary_min) ? `$${parseInt(item.salary_min).toLocaleString()}` : "面議";
        const maxStr = parseInt(item.salary_max) ? `$${parseInt(item.salary_max).toLocaleString()}` : "面議";
        
        detailsContainer.innerHTML = `
            <div class="salary-detail-card">
                <div class="detail-header">
                    <div>
                        <h3>${item.grade} | ${item.title_zh}</h3>
                        <span>${item.title_en}</span>
                    </div>
                    <div class="detail-salary-badge">
                        ${minStr} ~ ${maxStr} NTD
                    </div>
                </div>
                
                ${isFallback ? '<div style="color:var(--accent-teak-dark);font-size:11px;font-weight:600;margin-bottom:12px;background:var(--accent-teak-light);padding:4px 8px;border-radius:4px;"><i data-lucide="info" style="display:inline-block;width:12px;height:12px;vertical-align:middle;margin-right:4px;"></i>本數據為職階估算薪資區間，實際給薪依學經歷面議評定。</div>' : ''}

                <div class="detail-section">
                    <h5><i data-lucide="check-square" style="display:inline-block;width:14px;height:14px;vertical-align:middle;margin-right:4px;color:var(--primary-steel);"></i> 主要職職責與能力要求</h5>
                    <p>${item.requirements || "暫無詳細要求說明"}</p>
                </div>

                <div class="detail-section">
                    <h5><i data-lucide="trending-up" style="display:inline-block;width:14px;height:14px;vertical-align:middle;margin-right:4px;color:var(--primary-steel);"></i> 適用晉升條件</h5>
                    <p>${item.promotion || "完成階段性職能考核與年度考評認證"}</p>
                </div>

                <div class="detail-section">
                    <h5><i data-lucide="shield-alert" style="display:inline-block;width:14px;height:14px;vertical-align:middle;margin-right:4px;color:var(--primary-steel);"></i> 阿米巴角色分類</h5>
                    <p>${item.amoeba || "一般執行成員 / 學習者"}</p>
                </div>
            </div>
        `;
        initIcons();
    };

    // TAB 2: COMPETENCY MATRIX RENDER
    const renderMatrixTab = () => {
        const countSpan = document.getElementById("competency-count");
        const container = document.getElementById("matrix-categories-container");
        container.innerHTML = "";
        
        if (!activeJob || activeJob.competencies.length === 0) {
            countSpan.textContent = "0";
            container.innerHTML = `<div class="empty-state"><p>無職能指標數據</p></div>`;
            return;
        }

        countSpan.textContent = activeJob.competencies.length;

        // Group competencies by category
        const groups = {};
        activeJob.competencies.forEach(item => {
            const cat = item.category || "【其他核心能力】";
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(item);
        });

        // Render each category group
        for (const [catName, list] of Object.entries(groups)) {
            const groupDiv = document.createElement("div");
            groupDiv.className = "matrix-category-group";
            
            // Build table headers & rows
            let rowsHtml = "";
            list.forEach(item => {
                // Generate stars HTML
                let starsHtml = "";
                const starsCount = parseInt(item.importance) || 3;
                for (let i = 0; i < 5; i++) {
                    starsHtml += i < starsCount ? "★" : "☆";
                }

                // Parse target levels badge
                const targetLvl = item.target_level || "全職等適用";
                
                rowsHtml += `
                    <tr>
                        <td class="cell-code">${item.code}</td>
                        <td class="cell-dim">${item.dimension}</td>
                        <td>
                            <div class="cell-ability">${item.ability}</div>
                            <span class="category-badge">${targetLvl}</span>
                            <div class="matrix-level-grid">
                                <div class="level-box">
                                    <div class="level-box-title l0">L0 無能力</div>
                                    <div>${item.levels["0"] || "從未接觸/無相關經驗"}</div>
                                </div>
                                <div class="level-box">
                                    <div class="level-box-title l1">L1 基礎/認知</div>
                                    <div>${item.levels["1"] || "需在指導下執行"}</div>
                                </div>
                                <div class="level-box">
                                    <div class="level-box-title l2">L2 獨立作業</div>
                                    <div style="font-weight:500;color:var(--text-main);">${item.levels["2"] || "可獨立操作完成"}</div>
                                </div>
                                <div class="level-box">
                                    <div class="level-box-title l3">L3 主導/導師</div>
                                    <div>${item.levels["3"] || "可帶訓新人、建立SOP"}</div>
                                </div>
                            </div>
                        </td>
                        <td style="width: 100px; text-align: center;">
                            <span class="star-rating">${starsHtml}</span>
                        </td>
                    </tr>
                `;
            });

            groupDiv.innerHTML = `
                <div class="category-title-banner">${catName}</div>
                <table class="matrix-table">
                    <thead>
                        <tr>
                            <th style="width: 60px;">代號</th>
                            <th style="width: 130px;">職能面向</th>
                            <th>具體項目與四級判定標準</th>
                            <th style="width: 100px; text-align: center;">重要度</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            `;
            container.appendChild(groupDiv);
        }
    };

    // TAB 3: SELF EVALUATION & MATCHING RENDER
    const renderSelfEvalTab = () => {
        const evalList = document.getElementById("eval-questions-list");
        evalList.innerHTML = "";

        if (!activeJob || activeJob.competencies.length === 0) {
            evalList.innerHTML = `<div class="empty-state"><p>無職能指標自評資料</p></div>`;
            return;
        }

        activeJob.competencies.forEach(item => {
            const card = document.createElement("div");
            card.className = "eval-question-card";
            card.dataset.code = item.code;

            // Generate stars HTML
            let starsHtml = "";
            const starsCount = parseInt(item.importance) || 3;
            for (let i = 0; i < 5; i++) {
                starsHtml += i < starsCount ? "★" : "☆";
            }

            card.innerHTML = `
                <div class="question-meta">
                    <div>
                        <span class="category-badge" style="background-color:var(--primary-steel-light);color:var(--primary-steel-dark);">${item.dimension}</span>
                        <h4 class="question-title">${item.code}. ${item.ability}</h4>
                    </div>
                    <div class="question-meta-right">
                        <span class="star-rating" style="font-size:11px;">${starsHtml}</span>
                        <div class="eval-radio-group">
                            <label class="eval-radio-lbl" data-val="0">
                                <input type="radio" name="score_${item.code}" value="0" checked>0
                            </label>
                            <label class="eval-radio-lbl" data-val="1">
                                <input type="radio" name="score_${item.code}" value="1">1
                            </label>
                            <label class="eval-radio-lbl" data-val="2">
                                <input type="radio" name="score_${item.code}" value="2">2
                            </label>
                            <label class="eval-radio-lbl" data-val="3">
                                <input type="radio" name="score_${item.code}" value="3">3
                            </label>
                        </div>
                    </div>
                </div>
                <div class="selected-criteria-box" id="criteria-box-${item.code}">
                    <strong>能力層級 0: 無能力/不了解</strong>
                    <span>${item.levels["0"] || "無相關操作經驗。"}</span>
                </div>
            `;

            // Radio button click listeners
            const radioLabels = card.querySelectorAll(".eval-radio-lbl");
            radioLabels.forEach(lbl => {
                const radio = lbl.querySelector("input");
                lbl.addEventListener("click", () => {
                    const score = parseInt(lbl.dataset.val);
                    radio.checked = true;
                    
                    // Toggle active styles
                    radioLabels.forEach(l => {
                        l.className = "eval-radio-lbl";
                    });
                    lbl.classList.add(`active-${score}`);

                    // Update criteria detail box
                    const box = document.getElementById(`criteria-box-${item.code}`);
                    let lvlName = "無經驗/不了解";
                    if (score === 1) lvlName = "基礎認知 (需指導協助)";
                    else if (score === 2) lvlName = "獨立作業 (符合日常標準)";
                    else if (score === 3) lvlName = "主導/專家 (具帶訓與建立規範能力)";

                    box.innerHTML = `
                        <strong>能力層級 ${score}: ${lvlName}</strong>
                        <span>${item.levels[score] || "符合本級別日常作業標準。"}</span>
                    `;

                    // Update scores model
                    evalScores[item.code] = score;
                    calculateMatchingGrade();
                });
            });

            // Set default level 0 styling
            const firstLbl = card.querySelector('.eval-radio-lbl[data-val="0"]');
            if (firstLbl) firstLbl.classList.add("active-0");

            evalList.appendChild(card);
        });

        // Reset scores
        calculateMatchingGrade();
    };

    // SELF EVAL MATCHING ALGORITHM
    const calculateMatchingGrade = () => {
        let totalScore = 0;
        let answeredCount = 0;
        const keys = Object.keys(evalScores);
        keys.forEach(k => {
            totalScore += evalScores[k];
            if (evalScores[k] > 0) answeredCount++;
        });

        document.getElementById("eval-total-score").textContent = `${totalScore}分`;

        // Get salary structure (fallback if needed)
        let salaryData = activeJob.salary_structure || [];
        if (salaryData.length === 0) {
            salaryData = generateDefaultSalary(activeJob.job_name);
        }

        // Determine matching level
        // Let's parse custom numeric score thresholds if they are present in salary descriptions
        // For example: WH3A needs core >=15, WH3B >=25, etc.
        let matchedItem = salaryData[0]; // default to first/lowest level
        
        // Find if thresholds are written in the grade descriptions
        const maxPossibleScore = keys.length * 3;
        
        // Evaluate matching by checking thresholds
        for (let i = 0; i < salaryData.length; i++) {
            const item = salaryData[i];
            
            // Try to extract threshold score
            let thresh = -1;
            
            // Look into requirements or promotion criteria for "≥[0-9]+" or "門檻"
            const searchStr = `${item.requirements} ${item.promotion}`.toLowerCase();
            const scoreMatch = searchStr.match(/門檻\s*≥?\s*(\d+)/) || searchStr.match(/得分\s*≥?\s*(\d+)/) || searchStr.match(/分\s*≥?\s*(\d+)/) || searchStr.match(/(\d+)\s*分\s*(?:門檻|以上)/);
            
            if (scoreMatch) {
                thresh = parseInt(scoreMatch[1]);
            } else {
                // Positional logic threshold fallback if no explicit numbers are found in spreadsheet
                // WH3A: 0, WH3B: 15, WH4A: 38 etc., let's map them by ratio
                const rankRatio = i / (salaryData.length - 1 || 1);
                thresh = Math.round(rankRatio * maxPossibleScore * 0.7); // standard threshold ratio (70% of max score for top)
            }
            
            if (thresh !== -1 && totalScore >= thresh) {
                matchedItem = item;
            }
        }

        // Render matched card
        if (matchedItem) {
            document.getElementById("match-grade").textContent = matchedItem.grade;
            
            const minStr = parseInt(matchedItem.salary_min) ? `NT$ ${parseInt(matchedItem.salary_min).toLocaleString()}` : "面議";
            const maxStr = parseInt(matchedItem.salary_max) ? `NT$ ${parseInt(matchedItem.salary_max).toLocaleString()}` : "面議";
            document.getElementById("match-salary").textContent = `${minStr} ~ ${maxStr}`;

            // Build match explanation description
            let missingSkillsHtml = "";
            // Find next level requirements
            const currentIndex = salaryData.indexOf(matchedItem);
            let nextItem = null;
            if (currentIndex !== -1 && currentIndex < salaryData.length - 1) {
                nextItem = salaryData[currentIndex + 1];
            }

            let advice = "";
            if (nextItem) {
                // Extract next item's threshold score
                let nextThresh = Math.round((currentIndex + 1) / (salaryData.length - 1 || 1) * maxPossibleScore * 0.7);
                const nextSearch = `${nextItem.requirements} ${nextItem.promotion}`.toLowerCase();
                const nextScoreMatch = nextSearch.match(/門檻\s*≥?\s*(\d+)/) || nextSearch.match(/得分\s*≥?\s*(\d+)/) || nextSearch.match(/分\s*≥?\s*(\d+)/);
                if (nextScoreMatch) nextThresh = parseInt(nextScoreMatch[1]);

                const diff = nextThresh - totalScore;
                advice = `您的自評能力符合 <strong>${matchedItem.title_zh} (${matchedItem.grade})</strong> 級等標準。距離晉升下一階 <strong>${nextItem.title_zh} (${nextItem.grade})</strong> 還差約 <strong>${Math.max(1, diff)} 分</strong>，建議加強關鍵的獨立作業項目 (如重要度為 ★★★★★ 且自評低於 2 分的項目)。`;
            } else {
                advice = `恭喜！您的自評能力已達到該職系的最高職階 <strong>${matchedItem.title_zh} (${matchedItem.grade})</strong> 要求！具備完整的系統規劃與技術帶訓師資歷。`;
            }

            document.getElementById("match-description-text").innerHTML = advice;

            // Generate career recommendations list
            const recommendList = document.getElementById("recommendation-list");
            recommendList.innerHTML = "";

            // Find high importance items where score is low (0 or 1)
            const weakItems = activeJob.competencies.filter(c => {
                const score = evalScores[c.code] || 0;
                const imp = parseInt(c.importance) || 3;
                return score <= 1 && imp >= 4;
            });

            if (weakItems.length > 0) {
                weakItems.slice(0, 3).forEach(item => {
                    const li = document.createElement("li");
                    li.innerHTML = `<i data-lucide="trending-up"></i><span>加強 <strong>${item.code} ${item.dimension}</strong>: 需從基礎認知提升至獨立作業。指標要求：${item.levels["2"] || "可獨立執行操作。"}</span>`;
                    recommendList.appendChild(li);
                });
            } else {
                const li = document.createElement("li");
                li.innerHTML = `<i data-lucide="check-circle"></i><span>目前無急需加強的關鍵高優先度技能！已具備核心能力防線。</span>`;
                recommendList.appendChild(li);
            }
            initIcons();
        }

        // Update Circular matched chart background
        const circ = document.querySelector(".circular-progress");
        if (circ) {
            const percent = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
            circ.style.background = `conic-gradient(var(--primary-steel) ${percent}%, var(--border-office) ${percent}%)`;
        }

        // Dynamic Radar Chart render
        updateRadarChart();
    };

    // UPDATE RADAR CHART VISUALS
    const updateRadarChart = () => {
        const ctx = document.getElementById("competency-radar-chart");
        if (!ctx || !activeJob) return;

        // Group competencies by Dimension to calculate average self rating vs benchmark (2.0)
        const dimScores = {};
        activeJob.competencies.forEach(c => {
            const dim = c.dimension;
            if (!dimScores[dim]) {
                dimScores[dim] = { total: 0, count: 0 };
            }
            dimScores[dim].total += evalScores[c.code] || 0;
            dimScores[dim].count++;
        });

        const labels = Object.keys(dimScores);
        const userRatings = labels.map(label => {
            const avg = dimScores[label].total / dimScores[label].count;
            return parseFloat(avg.toFixed(2));
        });
        const benchmarkRatings = labels.map(() => 2.0); // 2.0 represents level 2: 獨立作業

        // Destroy previous chart if exists
        if (radarChart) {
            radarChart.destroy();
        }

        // Draw new chart
        radarChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '您的自評能力',
                        data: userRatings,
                        backgroundColor: 'rgba(2, 132, 199, 0.2)',
                        borderColor: 'rgba(2, 132, 199, 1)',
                        pointBackgroundColor: 'rgba(2, 132, 199, 1)',
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: 'rgba(2, 132, 199, 1)',
                        borderWidth: 2
                    },
                    {
                        label: '基準能力要求 (獨立作業)',
                        data: benchmarkRatings,
                        backgroundColor: 'rgba(217, 119, 6, 0.05)',
                        borderColor: 'rgba(217, 119, 6, 0.5)',
                        borderDash: [5, 5],
                        pointBackgroundColor: 'rgba(217, 119, 6, 0.5)',
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: 'rgba(217, 119, 6, 0.5)',
                        borderWidth: 1.5
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        angleLines: {
                            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#334155' : '#cbd5e1'
                        },
                        grid: {
                            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#334155' : '#cbd5e1'
                        },
                        pointLabels: {
                            font: {
                                size: 10,
                                family: 'Inter'
                            },
                            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#cbd5e1' : '#334155'
                        },
                        suggestedMin: 0,
                        suggestedMax: 3,
                        ticks: {
                            stepSize: 1,
                            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#94a3b8' : '#64748b',
                            backdropColor: 'transparent'
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            boxWidth: 12,
                            font: {
                                size: 11
                            },
                            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#cbd5e1' : '#334155'
                        }
                    }
                }
            }
        });
    };

    // RESET EVALUATION QUESTIONS
    const resetEvalBtn = document.getElementById("reset-eval-btn");
    if (resetEvalBtn) {
        resetEvalBtn.addEventListener("click", () => {
            const cards = document.querySelectorAll(".eval-question-card");
            cards.forEach(card => {
                const radioLabels = card.querySelectorAll(".eval-radio-lbl");
                radioLabels.forEach(lbl => {
                    lbl.className = "eval-radio-lbl";
                    if (lbl.dataset.val === "0") {
                        lbl.classList.add("active-0");
                        lbl.querySelector("input").checked = true;
                    }
                });
                
                const itemCode = card.dataset.code;
                const item = activeJob.competencies.find(c => c.code === itemCode);
                
                const box = document.getElementById(`criteria-box-${itemCode}`);
                box.innerHTML = `
                    <strong>能力層級 0: 無能力/不了解</strong>
                    <span>${item.levels["0"] || "無相關操作經驗。"}</span>
                `;
                
                evalScores[itemCode] = 0;
            });
            
            calculateMatchingGrade();
        });
    }

    // TAB 4: INTERVIEW GUIDE RENDER
    const renderInterviewTab = () => {
        const container = document.getElementById("interview-list-container");
        container.innerHTML = "";

        if (!activeJob || activeJob.competencies.length === 0) {
            container.innerHTML = `<div class="empty-state"><p>無面試查核指南資料</p></div>`;
            return;
        }

        activeJob.competencies.forEach(item => {
            if (!item.questions || item.questions.trim() === "") return;

            const card = document.createElement("div");
            card.className = "interview-card";
            card.innerHTML = `
                <div class="card-question">
                    <div style="display:flex;align-items:flex-start;gap:8px;">
                        <span class="lbl-q">Q</span>
                        <h4>【${item.dimension}】${item.questions}</h4>
                    </div>
                    <i data-lucide="chevron-down" class="toggle-icon"></i>
                </div>
                <div class="card-answer">
                    <div class="answer-header">💡 面試官評核重點與作答指南：</div>
                    <p style="margin-bottom:8px;"><strong>本項能力指標：</strong>${item.code} ${item.ability}</p>
                    <p style="color:var(--text-muted);">請針對本題結合您的實際工作案例進行回答。回答應包含：(1) 您曾經操作/處理過此項技術的專案經驗。(2) 當發生异常時，您是如何按照相關標準 SOP（如 IATF 或公司專利規範）進行處置或升報的。(3) 具備 Level 2（獨立執行）或 Level 3（主導培訓）的實際績效數據證明。</p>
                </div>
            `;

            // Toggle card collapse
            card.addEventListener("click", () => {
                const isOpen = card.classList.contains("open");
                document.querySelectorAll(".interview-card").forEach(c => c.classList.remove("open"));
                if (!isOpen) {
                    card.classList.add("open");
                }
            });

            container.appendChild(card);
        });

        initIcons();
        
        if (container.children.length === 0) {
            container.innerHTML = `<div class="empty-state" style="grid-column: span 2; height:200px;"><i data-lucide="smile"></i><p>本職缺之所有能力指標均以實作評核為主，暫無書面口試問題。</p></div>`;
            initIcons();
        }
    };

    // Print Report Button
    const printBtn = document.getElementById("print-btn");
    if (printBtn) {
        printBtn.addEventListener("click", () => {
            window.print();
        });
    }

    // 6. Start loading the interface
    renderSidebar();
    loadActiveJobData();
});

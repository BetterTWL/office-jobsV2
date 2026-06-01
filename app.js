// CORE SYSTEM SCRIPT WITH DYNAMIC CHARTS & VECTOR ICONS
// DYNAMIC RADAR MAPPING ENGINE & BINDER SECTIONS

document.addEventListener("DOMContentLoaded", () => {
    // 1. Clock Widget
    initClock();
    
    // 2. Load Roles
    initRoles();

    // 3. Tab Switching
    initTabs();

    // Init Lucide
    initIcons();
});

// GLOBAL STATE
let activeRole = "";
let currentScores = {}; // Map of compCode -> score
let currentVetos = {};   // Map of vetoIndex -> boolean
let radarChart = null;   // Chart.js instance

function initClock() {
    const clockEl = document.getElementById("current-time");
    
    function updateClock() {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        clockEl.textContent = `${yyyy}-${mm}-${dd} ${hh}:${min}`;
    }
    
    updateClock();
    setInterval(updateClock, 60000);
}

function initIcons() {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Group 14 roles into categories
const classifyJob = (jobName) => {
    const name = jobName.toLowerCase();
    if (name.includes("mis") || name.includes("資訊") || name.includes("韌體") || name.includes("機構") || name.includes("生技") || name.includes("維修") || name.includes("品管")) {
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

const getCategoryZh = (cat) => {
    if (cat === "tech") return "研發技術";
    if (cat === "manufacturing") return "生產製造";
    if (cat === "admin") return "行政管理";
    if (cat === "sales") return "商務開發";
    return "行政管理";
};

function initRoles() {
    const container = document.getElementById("role-list-container");
    container.innerHTML = "";
    
    const roles = Object.keys(SALARY_DATA);
    
    // Function to render roles based on filter & search query
    const renderSidebarList = (searchQuery = "", categoryFilter = "all") => {
        container.innerHTML = "";
        
        const filtered = roles.filter(roleName => {
            const matchesSearch = roleName.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = categoryFilter === "all" || classifyJob(roleName) === categoryFilter;
            return matchesSearch && matchesCategory;
        });

        if (filtered.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:12px;">無相符的職缺項目</div>`;
            return;
        }

        filtered.forEach(roleName => {
            const item = SALARY_DATA[roleName];
            const btn = document.createElement("button");
            btn.className = `role-item ${activeRole === roleName ? 'active' : ''}`;
            btn.setAttribute("data-role", roleName);
            
            const cat = classifyJob(roleName);
            const catZh = getCategoryZh(cat);
            
            // Calculate total competency counts
            let compCount = 0;
            if (item.categories) {
                item.categories.forEach(c => compCount += c.items.length);
            }

            btn.innerHTML = `
                <div class="role-info">
                    <h3>${roleName}</h3>
                    <span>${compCount} 項能力指標</span>
                </div>
                <span class="role-badge">${catZh}</span>
            `;
            
            btn.addEventListener("click", () => {
                document.querySelectorAll(".role-item").forEach(el => el.classList.remove("active"));
                btn.classList.add("active");
                selectRole(roleName);
            });
            
            container.appendChild(btn);
        });
    };

    // Bind Search Input
    const searchInput = document.getElementById("role-search");
    searchInput.addEventListener("input", (e) => {
        const activeFilter = document.querySelector(".filter-btn.active").getAttribute("data-filter");
        renderSidebarList(e.target.value, activeFilter);
    });

    // Bind Filter Category Buttons
    const filterBtns = document.querySelectorAll(".filter-group .filter-btn");
    filterBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            filterBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            
            const catFilter = btn.getAttribute("data-filter");
            renderSidebarList(searchInput.value, catFilter);
        });
    });

    // Initial render
    renderSidebarList("", "all");

    // Print button top-bar
    document.getElementById("print-btn-header").onclick = () => {
        if (activeRole) {
            showReportModal();
        }
    };

    // Auto load first role
    if (roles.length > 0) {
        selectRole(roles[0]);
        // Update first button as active
        setTimeout(() => {
            const firstBtn = container.querySelector(".role-item");
            if (firstBtn) firstBtn.classList.add("active");
        }, 100);
    }
}

function selectRole(roleName) {
    activeRole = roleName;
    
    document.getElementById("welcome-screen").classList.add("hidden");
    document.getElementById("workspace-inner").classList.remove("hidden");
    
    const roleData = SALARY_DATA[roleName];
    document.getElementById("current-role-title").textContent = roleName;
    document.getElementById("active-role-name").textContent = roleName;
    document.getElementById("active-role-file").textContent = roleData.filename;
    
    // Bounds & ranges
    let minSalary = Infinity;
    let maxSalary = -Infinity;
    if (roleData.grades && roleData.grades.length > 0) {
        roleData.grades.forEach(g => {
            if (g.min_salary < minSalary) minSalary = g.min_salary;
            if (g.max_salary > maxSalary) maxSalary = g.max_salary;
        });
    }
    
    const rangeEl = document.getElementById("active-role-salary-range");
    if (minSalary !== Infinity && maxSalary !== -Infinity) {
        rangeEl.textContent = `NT$ ${minSalary.toLocaleString()} ~ ${maxSalary.toLocaleString()}`;
    } else {
        rangeEl.textContent = "根據職能要求面議";
    }

    // Reset score sets
    currentScores = {};
    currentVetos = {};
    
    roleData.categories.forEach(cat => {
        cat.items.forEach(item => {
            currentScores[item.code] = 0;
        });
    });

    // Destroy chart if loaded
    if (radarChart) {
        radarChart.destroy();
        radarChart = null;
    }

    // Render modules
    renderCompetencyTab();
    renderGradesTab();
    renderCalculatorTab();
    renderAmoebaTab();
    renderComparisonsTab();
    
    // Initialize Radar Chart structure
    initRadarChart();

    // Default redirect to first view
    const firstTabBtn = document.querySelector('.tab-btn[data-tab="tab-competency"]');
    if (firstTabBtn) firstTabBtn.click();
    
    initIcons();
}

function initTabs() {
    const tabBtns = document.querySelectorAll(".tab-btn");
    const tabViews = document.querySelectorAll(".tab-view");
    
    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const tabId = btn.getAttribute("data-tab");
            
            tabBtns.forEach(b => b.classList.remove("active"));
            tabViews.forEach(v => v.classList.remove("active"));
            
            btn.classList.add("active");
            document.getElementById(tabId).classList.add("active");
            
            // Recheck/Update radar layout on tab swap
            if (tabId === "tab-calculator") {
                updateRadarChart();
            }
        });
    });

    const subTabBtns = document.querySelectorAll(".sub-tab-btn");
    const subTabContents = document.querySelectorAll(".sub-tab-content");

    subTabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const subId = btn.getAttribute("data-sub");

            subTabBtns.forEach(b => b.classList.remove("active"));
            subTabContents.forEach(c => c.classList.remove("active"));

            btn.classList.add("active");
            document.getElementById(subId).classList.add("active");
        });
    });
}

// ==========================================
// RENDER COMPONENT METHODS
// ==========================================

function renderCompetencyTab() {
    const tableBody = document.getElementById("competency-table-body");
    tableBody.innerHTML = "";
    
    const roleData = SALARY_DATA[activeRole];
    if (!roleData.categories || roleData.categories.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;">此職缺無能力矩陣數據</td></tr>`;
        return;
    }
    
    roleData.categories.forEach(cat => {
        const catRow = document.createElement("tr");
        catRow.className = "category-row";
        catRow.innerHTML = `<td colspan="7">[${cat.code}] ${cat.name}</td>`;
        tableBody.appendChild(catRow);
        
        cat.items.forEach(item => {
            const tr = document.createElement("tr");
            tr.className = "comp-row";
            tr.setAttribute("data-is-bonus", item.is_bonus ? "true" : "false");
            
            let stars = item.importance;
            if (!stars.includes("★") && !stars.includes("⭐")) {
                const count = parseInt(stars) || 3;
                stars = "★".repeat(count);
            }
            
            tr.innerHTML = `
                <td style="font-family: var(--font-mono); font-weight:bold;">${item.code}</td>
                <td style="font-weight:600; color:var(--text-muted);">${item.dimension}</td>
                <td>
                    <strong>${item.name}</strong>
                    ${item.is_bonus ? '<span class="badge-bonus">加分項</span>' : ''}
                    ${item.name.includes("【新】") ? '<span class="badge-new">NEW</span>' : ''}
                </td>
                <td>
                    <div style="white-space: pre-wrap; font-size:12px; color:var(--text-main);">${item.description}</div>
                    ${item.question ? `<div style="margin-top:6px; font-style:italic; color:var(--primary-steel-dark); font-size:11px; font-weight:500;">📋 查核要點：${item.question}</div>` : ''}
                </td>
                <td><span class="importance-stars">${stars}</span></td>
                <td style="font-family: var(--font-mono); text-align:center; font-weight:bold;">${item.weight}</td>
                <td style="font-size:11.5px; color:var(--text-muted);">${item.gate || '--'}</td>
            `;
            tableBody.appendChild(tr);
        });
    });

    const filterBtns = document.querySelectorAll(".filter-controls .filter-btn");
    filterBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            filterBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            
            const val = btn.getAttribute("data-filter");
            const rows = tableBody.querySelectorAll(".comp-row");
            
            rows.forEach(row => {
                const isBonus = row.getAttribute("data-is-bonus") === "true";
                if (val === "all") row.style.display = "table-row";
                else if (val === "core") row.style.display = isBonus ? "none" : "table-row";
                else if (val === "bonus") row.style.display = isBonus ? "table-row" : "none";
            });
        });
    });
}

function renderGradesTab() {
    const tableBody = document.getElementById("grades-table-body");
    tableBody.innerHTML = "";
    
    const chartContainer = document.getElementById("salary-chart-bars");
    chartContainer.innerHTML = "";
    
    const roleData = SALARY_DATA[activeRole];
    if (!roleData.grades || roleData.grades.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">無薪等頻寬數據</td></tr>`;
        chartContainer.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted);">無結構表資料</div>`;
        return;
    }
    
    const minScale = 20000;
    const maxScale = 140000;
    const scaleRange = maxScale - minScale;
    
    roleData.grades.forEach(g => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td style="font-family: var(--font-mono); font-weight:bold; color:var(--primary-steel-dark);">${g.grade}</td>
            <td>
                <strong>${g.title_zh}</strong><br>
                <small style="font-family:var(--font-mono); color:var(--text-muted);">${g.title_en}</small>
            </td>
            <td style="font-family: var(--font-mono); font-weight:bold;">
                NT$ ${g.min_salary.toLocaleString()} ~ ${g.max_salary.toLocaleString()}
            </td>
            <td style="font-size:12.5px; line-height: 1.45;">
                <div style="margin-bottom:4px;"><strong>能力要求：</strong>${g.core_requirements}</div>
                ${g.promotion_requirements ? `<div><strong>晉升標準：</strong>${g.promotion_requirements}</div>` : ''}
            </td>
            <td style="font-size:12px; font-weight: 600; color:var(--hud-purple);">${g.amoeba_role || '--'}</td>
        `;
        tableBody.appendChild(tr);
        
        // Render bar in telemetry chart
        const barRow = document.createElement("div");
        barRow.className = "salary-bar-row";
        
        const leftPercent = Math.max(0, ((g.min_salary - minScale) / scaleRange) * 100);
        const widthPercent = Math.max(8, ((g.max_salary - g.min_salary) / scaleRange) * 100);
        
        barRow.innerHTML = `
            <span class="grade-lbl">${g.grade}</span>
            <div class="salary-bar-wrapper">
                <div class="salary-bar-fill" style="left: ${leftPercent}%; width: ${widthPercent}%;">
                    $${Math.round(g.min_salary/1000)}k~$${Math.round(g.max_salary/1000)}k
                </div>
            </div>
        `;
        chartContainer.appendChild(barRow);
    });
}

function renderCalculatorTab() {
    const roleData = SALARY_DATA[activeRole];
    
    // 1. One-Vote Checklist
    const vetoContainer = document.getElementById("veto-checkboxes-container");
    vetoContainer.innerHTML = "";
    
    let allFailConditions = [];
    if (roleData.gates) {
        roleData.gates.forEach(gate => {
            if (gate.fail_conditions) {
                gate.fail_conditions.forEach(cond => {
                    if (!allFailConditions.includes(cond)) {
                        allFailConditions.push(cond);
                    }
                });
            }
        });
    }
    
    if (allFailConditions.length === 0) {
        vetoContainer.innerHTML = `<div style="font-size:12px; color:var(--text-muted); font-style:italic;">無設定否決性條款</div>`;
    } else {
        allFailConditions.forEach((cond, index) => {
            const div = document.createElement("div");
            div.className = "veto-item";
            const checkId = `veto-check-${index}`;
            div.innerHTML = `
                <input type="checkbox" id="${checkId}">
                <label for="${checkId}">否決: ${cond}</label>
            `;
            vetoContainer.appendChild(div);
            
            const checkbox = div.querySelector("input");
            checkbox.addEventListener("change", (e) => {
                currentVetos[index] = e.target.checked;
                recalculateScores();
            });
        });
    }

    // 2. Score Row Items
    const scorersContainer = document.getElementById("scorers-list-container");
    scorersContainer.innerHTML = "";
    
    roleData.categories.forEach(cat => {
        const header = document.createElement("div");
        header.className = "scorers-group-header";
        header.textContent = `[${cat.code}] ${cat.name}`;
        scorersContainer.appendChild(header);
        
        cat.items.forEach(item => {
            const row = document.createElement("div");
            row.className = "scorer-row";
            row.setAttribute("data-code", item.code);
            row.setAttribute("data-is-bonus", item.is_bonus ? "true" : "false");
            
            row.innerHTML = `
                <div class="info-col">
                    <div>
                        <span class="code-badge">${item.code}</span>
                        <span class="name-lbl">${item.name}</span>
                        ${item.is_bonus ? '<span class="badge-bonus">加分項</span>' : ''}
                    </div>
                    <div class="desc-lbl">${item.description}</div>
                </div>
                <div class="btn-group-score">
                    <button class="score-pill-btn active" data-score="0">0</button>
                    <button class="score-pill-btn" data-score="1">1</button>
                    <button class="score-pill-btn" data-score="2">2</button>
                    <button class="score-pill-btn" data-score="3">3</button>
                </div>
            `;
            scorersContainer.appendChild(row);
            
            const buttons = row.querySelectorAll(".score-pill-btn");
            buttons.forEach(btn => {
                btn.addEventListener("click", () => {
                    const score = parseInt(btn.getAttribute("data-score"));
                    
                    buttons.forEach(b => b.classList.remove("active"));
                    btn.classList.add("active");
                    
                    currentScores[item.code] = score;
                    recalculateScores();
                    updateRadarChart();
                });
            });
        });
    });

    // Reset & Max Scorers
    document.getElementById("btn-reset-scores").onclick = () => {
        document.querySelectorAll(".score-pill-btn").forEach(btn => {
            if (btn.getAttribute("data-score") === "0") btn.classList.add("active");
            else btn.classList.remove("active");
        });
        document.querySelectorAll(".veto-item input").forEach(cb => cb.checked = false);
        
        Object.keys(currentScores).forEach(k => currentScores[k] = 0);
        Object.keys(currentVetos).forEach(k => currentVetos[k] = false);
        
        recalculateScores();
        updateRadarChart();
    };

    document.getElementById("btn-max-scores").onclick = () => {
        document.querySelectorAll(".score-pill-btn").forEach(btn => {
            if (btn.getAttribute("data-score") === "3") btn.classList.add("active");
            else btn.classList.remove("active");
        });
        Object.keys(currentScores).forEach(k => currentScores[k] = 3);
        recalculateScores();
        updateRadarChart();
    };

    // Bind Assessment Report Cards Export Buttons
    document.getElementById("btn-export-report").onclick = showReportModal;
    document.getElementById("btn-close-modal").onclick = closeReportModal;
    document.getElementById("btn-print-report").onclick = () => window.print();
    document.getElementById("btn-copy-report").onclick = copyReportText;
}

function recalculateScores() {
    const roleData = SALARY_DATA[activeRole];
    
    let coreScore = 0;
    let maxCoreScore = 0;
    let bonusScore = 0;
    let maxBonusScore = 0;
    
    let scored = 0;
    let total = 0;
    
    roleData.categories.forEach(cat => {
        cat.items.forEach(item => {
            total++;
            const score = currentScores[item.code] || 0;
            if (score > 0) scored++;
            
            const wScore = score * item.weight;
            const maxWScore = 3 * item.weight;
            
            if (item.is_bonus) {
                bonusScore += wScore;
                maxBonusScore += maxWScore;
            } else {
                coreScore += wScore;
                maxCoreScore += maxWScore;
            }
        });
    });

    document.getElementById("hud-core-score").textContent = Math.round(coreScore);
    document.getElementById("hud-bonus-score").textContent = Math.round(bonusScore);
    
    const circ = 251.2;
    const corePercent = maxCoreScore > 0 ? coreScore / maxCoreScore : 0;
    const bonusPercent = maxBonusScore > 0 ? bonusScore / maxBonusScore : 0;
    
    document.getElementById("core-gauge-circle").style.strokeDashoffset = circ - (corePercent * circ);
    document.getElementById("bonus-gauge-circle").style.strokeDashoffset = circ - (bonusPercent * circ);

    const progressPercent = total > 0 ? Math.round((scored / total) * 100) : 0;
    document.getElementById("calc-progress-fill").style.width = `${progressPercent}%`;
    document.getElementById("calc-progress-percent").textContent = `${progressPercent}%`;

    // Check Veto conditions
    let vetoTriggered = false;
    let vetoReason = "";
    document.querySelectorAll(".veto-item input").forEach((cb) => {
        if (cb.checked) {
            vetoTriggered = true;
            vetoReason = cb.nextElementSibling.textContent.replace("否決: ", "");
        }
    });

    const vetoWarning = document.getElementById("veto-warning-lamp");
    const vetoStatusText = document.getElementById("veto-status-text");
    if (vetoTriggered) {
        vetoWarning.classList.add("blinking");
        vetoStatusText.textContent = `🚨 否決: ${vetoReason}`;
        vetoStatusText.className = "value color-red";
    } else {
        vetoWarning.classList.remove("blinking");
        vetoStatusText.textContent = "安全 (無否決條款觸發) 🟢";
        vetoStatusText.className = "value color-green";
    }

    // Recommended Grade Matcher
    let recommendedGrade = null;
    if (roleData.gates && roleData.gates.length > 0 && !vetoTriggered) {
        const reversedGates = [...roleData.gates].reverse();
        for (let i = 0; i < reversedGates.length; i++) {
            const gate = reversedGates[i];
            if (coreScore >= gate.core_gate && bonusScore >= gate.bonus_gate) {
                recommendedGrade = gate;
                break;
            }
        }
    }

    const gradeOutput = document.getElementById("calc-recommended-grade");
    const salaryOutput = document.getElementById("calc-recommended-salary");
    const amoebaOutput = document.getElementById("calc-amoeba-role");
    const calcStatusLamp = document.getElementById("calc-status-lamp");

    // Visual scale mappings
    const scaleMin = 20000;
    const scaleMax = 140000;
    const scaleRange = scaleMax - scaleMin;

    let roleMin = Infinity;
    let roleMax = -Infinity;
    roleData.grades.forEach(g => {
        if (g.min_salary < roleMin) roleMin = g.min_salary;
        if (g.max_salary > roleMax) roleMax = g.max_salary;
    });

    if (roleMin === Infinity) roleMin = 30000;
    if (roleMax === -Infinity) roleMax = 130000;

    document.getElementById("beam-axis-min").textContent = `$${Math.round(roleMin/1000)}k`;
    document.getElementById("beam-axis-max").textContent = `$${Math.round(roleMax/1000)}k`;
    document.getElementById("beam-axis-mid").textContent = `$${Math.round((roleMin+roleMax)/2000)}k`;

    const highlightLeft = Math.max(0, ((roleMin - scaleMin) / scaleRange) * 100);
    const highlightWidth = Math.max(10, ((roleMax - roleMin) / scaleRange) * 100);
    
    const beamHighlight = document.getElementById("salary-beam-highlight");
    beamHighlight.style.left = `${highlightLeft}%`;
    beamHighlight.style.width = `${highlightWidth}%`;

    const beamIndicator = document.getElementById("salary-beam-indicator");
    const beamVal = document.getElementById("salary-beam-val");

    if (vetoTriggered) {
        gradeOutput.textContent = "✗ 否決不錄用";
        gradeOutput.className = "value color-red";
        salaryOutput.textContent = "--";
        amoebaOutput.textContent = "--";
        calcStatusLamp.className = "status-lamp red-lamp blinking";
        
        beamIndicator.style.left = `0%`;
        beamVal.textContent = "VETO";
        beamVal.style.color = "var(--hud-red)";
    } else if (recommendedGrade) {
        gradeOutput.textContent = `${recommendedGrade.grade} (${recommendedGrade.title})`;
        gradeOutput.className = "value color-yellow";
        salaryOutput.textContent = `NT$ ${recommendedGrade.salary_range}`;
        
        const matchedGradeStruct = roleData.grades.find(g => g.grade === recommendedGrade.grade);
        amoebaOutput.textContent = matchedGradeStruct ? matchedGradeStruct.amoeba_role : "--";
        calcStatusLamp.className = "status-lamp green-lamp blinking";

        let minVal = 30000;
        let maxVal = 40000;
        if (matchedGradeStruct) {
            minVal = matchedGradeStruct.min_salary;
            maxVal = matchedGradeStruct.max_salary;
        }
        const midVal = (minVal + maxVal) / 2;

        const indicatorLeft = Math.max(0, Math.min(100, ((midVal - scaleMin) / scaleRange) * 100));
        beamIndicator.style.left = `${indicatorLeft}%`;
        beamVal.textContent = `$${Math.round(midVal/1000)}k`;
        beamVal.style.color = "var(--primary-steel-dark)";
    } else {
        gradeOutput.textContent = "未達任用門檻";
        gradeOutput.className = "value color-red";
        salaryOutput.textContent = "--";
        amoebaOutput.textContent = "--";
        calcStatusLamp.className = "status-lamp red-lamp";
        
        beamIndicator.style.left = `0%`;
        beamVal.textContent = "--";
        beamVal.style.color = "var(--text-muted)";
    }

    // Dynamic Gates reference checklist
    const gatesList = document.getElementById("calc-gates-status-list");
    gatesList.innerHTML = "";
    
    if (roleData.gates) {
        roleData.gates.forEach(gate => {
            const passCore = coreScore >= gate.core_gate;
            const passBonus = bonusScore >= gate.bonus_gate;
            const passAll = passCore && passBonus;
            
            const div = document.createElement("div");
            div.className = `gate-row-telemetry ${passAll ? 'passed' : 'failed'}`;
            
            div.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="status-indicator"></span>
                    <span class="name">${gate.grade} - ${gate.title}</span>
                </div>
                <div class="scores">
                    核心: ${Math.round(coreScore)}/${gate.core_gate} | 
                    加分: ${Math.round(bonusScore)}/${gate.bonus_gate}
                </div>
            `;
            gatesList.appendChild(div);
        });
    }
}

// ==========================================
// RADAR CHART INTEGRATION
// ==========================================

function initRadarChart() {
    const roleData = SALARY_DATA[activeRole];
    if (!roleData.categories || roleData.categories.length === 0) return;
    
    const labels = roleData.categories.map(c => {
        // Truncate category labels if they are too long
        let title = `[${c.code}] ${c.name}`;
        if (title.length > 15) {
            title = title.substring(0, 14) + "...";
        }
        return title;
    });

    const datasetData = roleData.categories.map(() => 0); // initial zeros

    const ctx = document.getElementById('competency-radar-chart').getContext('2d');
    
    radarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                label: '職能覆蓋得分 (%)',
                data: datasetData,
                backgroundColor: 'rgba(2, 132, 199, 0.2)',
                borderColor: 'rgba(2, 132, 199, 0.8)',
                borderWidth: 2,
                pointBackgroundColor: 'rgba(2, 132, 199, 1)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(2, 132, 199, 1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: {
                        color: '#cbd5e1'
                    },
                    grid: {
                        color: '#f1f5f9'
                    },
                    pointLabels: {
                        font: {
                            family: "'Inter', sans-serif",
                            size: 9,
                            weight: 'bold'
                        },
                        color: '#475569'
                    },
                    ticks: {
                        stepSize: 20,
                        font: {
                            size: 8
                        }
                    },
                    suggestedMin: 0,
                    suggestedMax: 100
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });

    updateRadarChart();
}

function updateRadarChart() {
    if (!radarChart) return;
    const roleData = SALARY_DATA[activeRole];
    if (!roleData.categories) return;

    // Calculate percentage achieved for each category
    const percentages = roleData.categories.map(cat => {
        let earned = 0;
        let maxPossible = 0;
        cat.items.forEach(item => {
            const score = currentScores[item.code] || 0;
            earned += score * item.weight;
            maxPossible += 3 * item.weight;
        });
        return maxPossible > 0 ? Math.round((earned / maxPossible) * 100) : 0;
    });

    radarChart.data.datasets[0].data = percentages;
    radarChart.update();
}

// ==========================================
// AMOEBA & COMPARISON RENDERING
// ==========================================

function renderAmoebaTab() {
    const roleData = SALARY_DATA[activeRole];
    
    const descEl = document.getElementById("amoeba-formula-text");
    if (roleData.amoeba && roleData.amoeba.formula) {
        descEl.innerHTML = `阿米巴核算公式：<strong>${roleData.amoeba.formula}</strong>`;
    } else {
        descEl.textContent = "時間附加值 = (銷售額分攤 - 外部費用) ÷ 總工時";
    }

    const tableHead = document.getElementById("amoeba-table-head");
    const tableBody = document.getElementById("amoeba-table-body");
    tableHead.innerHTML = "";
    tableBody.innerHTML = "";

    if (!roleData.amoeba || !roleData.amoeba.rows || roleData.amoeba.rows.length === 0) {
        let backupAmoebaSheet = Object.keys(roleData.raw_sheets).find(k => k.includes("阿米巴") || k.includes("損益"));
        if (backupAmoebaSheet) {
            renderRawTable(tableHead, tableBody, roleData.raw_sheets[backupAmoebaSheet]);
        } else {
            tableBody.innerHTML = `<tr><td style="text-align:center; padding:20px; color:var(--text-muted);">本職稱未配置阿米巴核算表。</td></tr>`;
        }
        return;
    }

    const rows = roleData.amoeba.rows;
    const headers = [
        "日期", "星期", "作業類別/項目", "完成數/件數", "總工時 (h)", "分攤銷售額 (NTD)", "外部費用 (NTD)", "附加值 (NTD)", "工時附加值 (NTD/h)"
    ];
    
    let trHead = document.createElement("tr");
    headers.forEach(h => {
        let th = document.createElement("th");
        th.textContent = h;
        trHead.appendChild(th);
    });
    tableHead.appendChild(trHead);

    rows.forEach(row => {
        if (row[0] && (row[0].includes("公式") || row[0].includes("附加值") || row[0].includes("損益表"))) {
            return;
        }

        const tr = document.createElement("tr");
        let htmlStr = "";
        let colCount = 9;
        
        for (let i = 0; i < colCount; i++) {
            let val = row[i] !== undefined ? row[i] : "";
            
            if (i === 8 && typeof val === "number") {
                htmlStr += `<td style="font-family:var(--font-mono); font-weight:bold; color:var(--hud-blue);">$${val.toLocaleString()} / h</td>`;
            } else if ((i === 5 || i === 6 || i === 7) && typeof val === "number") {
                htmlStr += `<td style="font-family:var(--font-mono);">$${val.toLocaleString()}</td>`;
            } else {
                htmlStr += `<td>${val}</td>`;
            }
        }
        tr.innerHTML = htmlStr;
        tableBody.appendChild(tr);
    });

    // Sim variables
    const simSales = document.getElementById("sim-sales");
    const simExpenses = document.getElementById("sim-expenses");
    const simHours = document.getElementById("sim-hours");
    const simTarget = document.getElementById("sim-target-rate");

    function reSimulate() {
        const sales = parseFloat(simSales.value) || 0;
        const expenses = parseFloat(simExpenses.value) || 0;
        const hours = parseFloat(simHours.value) || 1;
        const target = parseFloat(simTarget.value) || 800;

        const val = sales - expenses;
        const rate = val / hours;
        const pct = target > 0 ? (rate / target) * 100 : 0;

        document.getElementById("sim-result-value").textContent = `NT$ ${Math.round(val).toLocaleString()}`;
        document.getElementById("sim-result-rate").textContent = `NT$ ${rate.toFixed(1)} / h`;
        
        const statusEl = document.getElementById("sim-result-status");
        if (rate >= target) {
            statusEl.textContent = `已達標 (${pct.toFixed(1)}%) 🟢`;
            statusEl.className = "value badge green-badge";
        } else {
            statusEl.textContent = `未達標 (${pct.toFixed(1)}%) 🚨`;
            statusEl.className = "value badge red-badge";
        }
    }

    simSales.oninput = reSimulate;
    simExpenses.oninput = reSimulate;
    simHours.oninput = reSimulate;
    simTarget.oninput = reSimulate;

    reSimulate();
}

function renderRawTable(tableHead, tableBody, rows) {
    if (rows.length === 0) return;
    
    let trHead = document.createElement("tr");
    rows[0].forEach(cell => {
        let th = document.createElement("th");
        th.textContent = cell;
        trHead.appendChild(th);
    });
    tableHead.appendChild(trHead);

    for (let r = 1; r < rows.length; r++) {
        let tr = document.createElement("tr");
        rows[r].forEach(cell => {
            let td = document.createElement("td");
            td.textContent = cell;
            tr.appendChild(td);
        });
        tableBody.appendChild(tr);
    }
}

function renderComparisonsTab() {
    const roleData = SALARY_DATA[activeRole];

    // 1. Kanban
    const todo = document.querySelector("#kanban-todo .kanban-cards-wrapper");
    const progress = document.querySelector("#kanban-progress .kanban-cards-wrapper");
    const done = document.querySelector("#kanban-done .kanban-cards-wrapper");

    todo.innerHTML = "";
    progress.innerHTML = "";
    done.innerHTML = "";

    let sprintSheet = Object.keys(roleData.raw_sheets).find(k => k.includes("Sprint") || k.includes("敏捷") || k.includes("看板"));
    let cards = [];
    
    if (sprintSheet) {
        const rows = roleData.raw_sheets[sprintSheet];
        let hIndex = -1;
        for (let i = 0; i < rows.length; i++) {
            if (rows[i][0] && (rows[i][0].includes("Story ID") || rows[i][0].includes("序"))) {
                hIndex = i;
                break;
            }
        }
        
        if (hIndex !== -1) {
            for (let i = hIndex + 1; i < rows.length; i++) {
                const r = rows[i];
                if (!r[0]) continue;
                cards.push({
                    id: r[0],
                    name: r[1] || "工作事項",
                    desc: r[2] || "任務內容",
                    owner: r[3] || "主責人員",
                    points: r[4] || "1",
                    status: (r[6] || "待辦").trim()
                });
            }
        }
    }

    if (cards.length === 0) {
        cards = [
            { id: "TSK-001", name: "能力考評建檔", desc: "完成受評人員考核分數存檔與核算", owner: "人資部", points: "3", status: "進行中" },
            { id: "TSK-002", name: "阿米巴核對", desc: "計算本期工時單位時間附加值目標", owner: "巴長", points: "5", status: "待辦" },
            { id: "TSK-003", name: "文件準備", desc: "彙整 IATF 人員技能訓練記錄歸檔", owner: "廠務課", points: "2", status: "已完成" }
        ];
    }

    cards.forEach(card => {
        const div = document.createElement("div");
        div.className = "kanban-card";
        div.innerHTML = `
            <div class="card-id">${card.id}</div>
            <div class="card-desc"><strong>${card.name}</strong> - ${card.desc}</div>
            <div class="card-meta">
                <span class="owner">${card.owner}</span>
                <span class="points">${card.points} Pts</span>
            </div>
        `;
        
        let s = card.status.toLowerCase();
        if (s.includes("done") || s.includes("完成")) done.appendChild(div);
        else if (s.includes("progress") || s.includes("進行")) progress.appendChild(div);
        else todo.appendChild(div);
    });

    document.querySelector("#kanban-todo .card-count").textContent = todo.children.length;
    document.querySelector("#kanban-progress .card-count").textContent = progress.children.length;
    document.querySelector("#kanban-done .card-count").textContent = done.children.length;

    // 2. 104 HR
    const hrTableBody = document.getElementById("hr104-table-body");
    hrTableBody.innerHTML = "";
    let hrSheet = Object.keys(roleData.raw_sheets).find(k => k.includes("104HR") || k.includes("104"));
    
    if (hrSheet) {
        const rows = roleData.raw_sheets[hrSheet];
        let hIndex = -1;
        for (let i = 0; i < rows.length; i++) {
            if (rows[i][0] && rows[i][0].includes("104管理層級")) {
                hIndex = i;
                break;
            }
        }
        
        if (hIndex !== -1) {
            for (let i = hIndex + 1; i < rows.length; i++) {
                const r = rows[i];
                if (!r[0]) continue;
                
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td style="font-weight:bold; color:var(--hud-blue);">${r[0]}</td>
                    <td style="font-weight:600;">${r[1]}</td>
                    <td style="font-size:12.5px;">${r[2]}</td>
                    <td style="font-size:12.5px;">${r[3]} ${r[4] ? `<br><small style="color:var(--text-muted)">對照職能: ${r[4]}</small>` : ''}</td>
                    <td style="font-family:var(--font-mono); text-align:center; font-weight:bold;">${r[5] || '--'}</td>
                    <td style="font-size:12.5px; color:var(--success-green); font-weight:600;">${r[6] || '--'}</td>
                `;
                hrTableBody.appendChild(tr);
            }
        }
    }
    
    if (hrTableBody.children.length === 0) {
        hrTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">本職缺無 104 HR 對照架構</td></tr>`;
    }

    // 3. CMP
    const cmpTableBody = document.getElementById("cmp-table-body");
    cmpTableBody.innerHTML = "";
    let cmpSheet = Object.keys(roleData.raw_sheets).find(k => k.includes("CMP") || k.includes("政策"));
    
    if (cmpSheet) {
        const rows = roleData.raw_sheets[cmpSheet];
        let hIndex = -1;
        for (let i = 0; i < rows.length; i++) {
            if (rows[i][0] && rows[i][0].includes("CMP")) {
                hIndex = i;
                break;
            }
        }

        if (hIndex !== -1) {
            for (let i = hIndex + 1; i < rows.length; i++) {
                const r = rows[i];
                if (!r[0]) continue;

                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td style="font-family:var(--font-mono); font-weight:bold; color:var(--hud-red);">${r[0]}</td>
                    <td style="font-weight:700;">${r[1]}</td>
                    <td style="font-size:12.5px;">${r[2]}</td>
                    <td style="font-size:12.5px; color:var(--hud-blue); font-weight:500;">${r[3]} <br><small style="color:var(--text-muted)">${r[4] || ''}</small></td>
                    <td style="font-family:var(--font-mono); text-align:center; font-weight:bold;">${r[5] || '--'}</td>
                    <td style="font-size:12.5px; font-style:italic;">${r[6] || '--'}</td>
                `;
                cmpTableBody.appendChild(tr);
            }
        }
    }

    if (cmpTableBody.children.length === 0) {
        cmpTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">本職稱無設定 CMP 辦法對照</td></tr>`;
    }
}

// ==========================================
// REPORT MODAL ENGINE
// ==========================================

function showReportModal() {
    const roleData = SALARY_DATA[activeRole];
    const modal = document.getElementById("report-modal");
    const paper = document.getElementById("report-content-paper");
    
    let coreScore = 0;
    let maxCoreScore = 0;
    let bonusScore = 0;
    let maxBonusScore = 0;
    let scoredItems = [];
    
    roleData.categories.forEach(cat => {
        cat.items.forEach(item => {
            const score = currentScores[item.code] || 0;
            const wScore = score * item.weight;
            const maxWScore = 3 * item.weight;
            
            if (score > 0) {
                scoredItems.push({
                    code: item.code,
                    name: item.name,
                    score: score,
                    weight: item.weight,
                    weighted: wScore,
                    is_bonus: item.is_bonus
                });
            }
            
            if (item.is_bonus) {
                bonusScore += wScore;
                maxBonusScore += maxWScore;
            } else {
                coreScore += wScore;
                maxCoreScore += maxWScore;
            }
        });
    });

    let vetoTriggered = false;
    let triggeredVetoes = [];
    document.querySelectorAll(".veto-item input").forEach((cb) => {
        if (cb.checked) {
            vetoTriggered = true;
            triggeredVetoes.push(cb.nextElementSibling.textContent.replace("否決: ", ""));
        }
    });

    let recommendedGrade = null;
    if (roleData.gates && roleData.gates.length > 0 && !vetoTriggered) {
        const reversedGates = [...roleData.gates].reverse();
        for (let i = 0; i < reversedGates.length; i++) {
            const gate = reversedGates[i];
            if (coreScore >= gate.core_gate && bonusScore >= gate.bonus_gate) {
                recommendedGrade = gate;
                break;
            }
        }
    }

    const matchedGradeStruct = recommendedGrade ? roleData.grades.find(g => g.grade === recommendedGrade.grade) : null;
    const amoebaRole = matchedGradeStruct ? matchedGradeStruct.amoeba_role : "--";

    let html = `
        <div class="report-header">
            <!-- TWL Logo Image -->
            <img src="logo.png" alt="TWL Logo" class="twl-logo-report">
            <h2>騏宏科技股份有限公司</h2>
            <div style="font-size:15px; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; margin-top:6px;">職能等級與薪資核定評估報告書</div>
            <div style="font-size:10px; color:var(--text-muted); font-family:var(--font-mono); margin-top:4px;">DOCID: QH-REP-FM-${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}</div>
        </div>
        
        <div class="report-meta-grid">
            <div><strong>核定職缺:</strong> ${activeRole}</div>
            <div><strong>依據文件:</strong> ${roleData.filename}</div>
            <div><strong>核估時間:</strong> ${document.getElementById("current-time").textContent}</div>
            <div><strong>評核終端:</strong> QH-GradeTelemetry v2.7</div>
        </div>
        
        <div class="report-section">
            <h3>一、 評分數據彙整</h3>
            <table class="report-table">
                <thead>
                    <tr>
                        <th>能力維度</th>
                        <th>得加權總分</th>
                        <th>本職能總配分</th>
                        <th>得分百分比</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>[核心能力加權得分]</strong></td>
                        <td><strong>${Math.round(coreScore)} 分</strong></td>
                        <td>${Math.round(maxCoreScore)} 分</td>
                        <td>${maxCoreScore > 0 ? ((coreScore/maxCoreScore)*100).toFixed(1) : 0}%</td>
                    </tr>
                    <tr>
                        <td><strong>[加分項加權得分]</strong></td>
                        <td><strong>${Math.round(bonusScore)} 分</strong></td>
                        <td>${Math.round(maxBonusScore)} 分</td>
                        <td>${maxBonusScore > 0 ? ((bonusScore/maxBonusScore)*100).toFixed(1) : 0}%</td>
                    </tr>
                </tbody>
            </table>
        </div>
        
        <div class="report-section">
            <h3>二、 核定結論</h3>
            <div style="padding:18px; border:2px solid var(--border-office); border-radius:4px; background-color:var(--bg-grid-panel); font-size:13px; line-height:1.6;">
                ${vetoTriggered ? `
                    <div style="color:var(--hud-red); font-weight:800; font-size:14px; margin-bottom:8px;">🚨 否決結論：觸發一票否決條款（不予任用/晉升）</div>
                    <div><strong>觸發否決條款明細：</strong></div>
                    <ul style="margin-left: 20px; color:var(--hud-red); font-weight:600;">
                        ${triggeredVetoes.map(v => `<li>${v}</li>`).join("")}
                    </ul>
                ` : recommendedGrade ? `
                    <div style="color:var(--success-green); font-weight:800; font-size:15px; margin-bottom:10px;">✅ 評核結論：通過門檻，建議聘任/晉升</div>
                    <table style="width:100%; font-size:13px; border-collapse:collapse;">
                        <tr>
                            <td style="padding:5px 0; width:130px; color:#555;"><strong>核定推薦職等:</strong></td>
                            <td><strong>${recommendedGrade.grade} (${recommendedGrade.title})</strong></td>
                        </tr>
                        <tr>
                            <td style="padding:5px 0; color:#555;"><strong>月薪標準頻寬:</strong></td>
                            <td><strong style="color:var(--hud-blue); font-size:16px;">NT$ ${recommendedGrade.salary_range}</strong> (基本本薪)</td>
                        </tr>
                        <tr>
                            <td style="padding:5px 0; color:#555;"><strong>阿米巴角色:</strong></td>
                            <td>${amoebaRole}</td>
                        </tr>
                        <tr>
                            <td style="padding:5px 0; color:#555;"><strong>晉量通過率:</strong></td>
                            <td>${recommendedGrade.pass_rate}</td>
                        </tr>
                        <tr>
                            <td style="padding:5px 0; color:#555;"><strong>比對門檻:</strong></td>
                            <td>核心達標分: ≥${recommendedGrade.core_gate}分 ｜ 加分達標分: ≥${recommendedGrade.bonus_gate}分</td>
                        </tr>
                    </table>
                ` : `
                    <div style="color:var(--hud-red); font-weight:800; font-size:14px;">🚨 評核結論：未達最低職等起薪門檻</div>
                    <div style="margin-top:6px;">受評者加權得分未達最低門檻。</div>
                `}
            </div>
        </div>

        <div class="report-section">
            <h3>三、 評估細項明細</h3>
            <table class="report-table">
                <thead>
                    <tr>
                        <th style="width:70px;">代碼</th>
                        <th>具體能力項目</th>
                        <th style="width:60px; text-align:center;">評核分</th>
                        <th style="width:60px; text-align:center;">權重</th>
                        <th style="width:80px; text-align:center;">加權得分</th>
                        <th style="width:70px; text-align:center;">類型</th>
                    </tr>
                </thead>
                <tbody>
                    ${scoredItems.length > 0 ? scoredItems.map(item => `
                        <tr>
                            <td style="font-family:var(--font-mono); font-weight:bold;">${item.code}</td>
                            <td style="font-weight:600;">${item.name}</td>
                            <td style="text-align:center; font-weight:bold;">${item.score}</td>
                            <td style="text-align:center; font-family:var(--font-mono);">${item.weight}</td>
                            <td style="text-align:center; font-weight:bold; color:var(--hud-blue); font-family:var(--font-mono);">${item.weighted}</td>
                            <td style="text-align:center;">${item.is_bonus ? '<span style="color:var(--hud-purple); font-weight:600;">加分</span>' : '核心'}</td>
                        </tr>
                    `).join("") : '<tr><td colspan="6" style="text-align:center; color:#999;">無任何能力評定大於 0 分。</td></tr>'}
                </tbody>
            </table>
        </div>

        <div class="report-footer-signature">
            <div class="sig-box">考評委員代表代表簽章</div>
            <div class="sig-box">核決主管簽署</div>
        </div>
    `;
    
    paper.innerHTML = html;
    modal.classList.add("active");
    initIcons();
}

function closeReportModal() {
    document.getElementById("report-modal").classList.remove("active");
}

function copyReportText() {
    const reportText = document.getElementById("report-content-paper").innerText;
    navigator.clipboard.writeText(reportText).then(() => {
        alert("評估報告書純文字內容已複製至剪貼簿！");
    }).catch(err => {
        console.error("Copy failed", err);
    });
}

// 思维导图应用主逻辑
class MindMap {
    constructor() {
        this.nodes = new Map();
        this.rootNode = null;
        this.selectedNode = null;
        this.hoveredNode = null;
        this.nextId = 1;
        
        // 画布变换参数
        this.scale = 1;
        this.translateX = 0;
        this.translateY = 0;
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        
        // 编辑状态
        this.editingNode = null;
        this.editingEditor = null;
        
        // 拖拽状态
        this.isDraggingNode = false;
        this.draggedNode = null;
        this.dropTargetNode = null;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragPreview = null;
        
        // 撤销/重做
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 50;
        
        // AI配置
        this.aiConfig = this.loadAIConfig();
        this.availableModels = [];
        
        // DOM元素
        this.canvas = document.getElementById('canvas');
        this.canvasContainer = document.getElementById('canvasContainer');
        this.nodesGroup = document.getElementById('nodesGroup');
        this.linesGroup = document.getElementById('linesGroup');
        this.contextMenu = document.getElementById('contextMenu');
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.createRootNode();
        this.saveState();
        this.render();
    }
    
    setupEventListeners() {
        // 画布拖拽和缩放
        this.canvasContainer.addEventListener('mousedown', this.onCanvasMouseDown.bind(this));
        this.canvasContainer.addEventListener('mousemove', this.onCanvasMouseMove.bind(this));
        this.canvasContainer.addEventListener('mouseup', this.onCanvasMouseUp.bind(this));
        this.canvasContainer.addEventListener('mouseleave', this.onCanvasMouseUp.bind(this));
        this.canvasContainer.addEventListener('wheel', this.onCanvasWheel.bind(this));
        
        // 右键菜单
        this.canvasContainer.addEventListener('contextmenu', this.onContextMenu.bind(this));
        document.addEventListener('click', () => this.hideContextMenu());
        
        // 键盘事件
        document.addEventListener('keydown', this.onKeyDown.bind(this));
        
        // 工具栏按钮
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('redoBtn').addEventListener('click', () => this.redo());
        document.getElementById('settingsBtn').addEventListener('click', () => this.showSettingsModal());
        document.getElementById('exportMarkdownBtn').addEventListener('click', () => this.exportMarkdown());
        document.getElementById('exportTxtBtn').addEventListener('click', () => this.exportTxt());
        document.getElementById('exportHtmlBtn').addEventListener('click', () => this.exportHtml());
        document.getElementById('resetViewBtn').addEventListener('click', () => this.resetView());
        
        // 右键菜单项
        document.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                this.handleContextMenuAction(action);
            });
        });
        
        // AI设置模态框
        this.setupSettingsModal();
        this.setupAIExpandModal();
    }
    
    setupSettingsModal() {
        const modal = document.getElementById('settingsModal');
        const closeBtn = modal.querySelector('.close');
        const cancelBtn = document.getElementById('cancelSettingsBtn');
        const saveBtn = document.getElementById('saveSettingsBtn');
        const providerSelect = document.getElementById('apiProvider');
        const customUrlGroup = document.getElementById('customUrlGroup');
        const apiKeyInput = document.getElementById('apiKey');
        const modelSelect = document.getElementById('modelSelect');
        const modelNameInput = document.getElementById('modelName');
        
        closeBtn.addEventListener('click', () => modal.style.display = 'none');
        cancelBtn.addEventListener('click', () => modal.style.display = 'none');
        saveBtn.addEventListener('click', () => this.saveAISettings());
        
        providerSelect.addEventListener('change', (e) => {
            customUrlGroup.style.display = e.target.value === 'custom' ? 'block' : 'none';
        });
        
        // API Key输入后自动加载模型
        apiKeyInput.addEventListener('blur', () => {
            if (apiKeyInput.value.trim()) {
                this.loadAvailableModels();
            }
        });
        
        // 模型选择下拉框
        modelSelect.addEventListener('change', (e) => {
            modelNameInput.value = e.target.value;
        });
        
        // 模型名称输入框 - 搜索过滤
        modelNameInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            if (this.availableModels.length > 0 && searchTerm) {
                const filtered = this.availableModels.filter(m => 
                    m.toLowerCase().includes(searchTerm)
                );
                this.updateModelSelect(filtered);
                modelSelect.style.display = filtered.length > 0 ? 'block' : 'none';
            } else {
                modelSelect.style.display = 'none';
            }
        });
        
        modelNameInput.addEventListener('focus', () => {
            if (this.availableModels.length > 0) {
                this.updateModelSelect(this.availableModels);
                modelSelect.style.display = 'block';
            }
        });
        
        // 加载已保存的设置
        this.loadAISettingsToForm();
    }
    
    updateModelSelect(models) {
        const modelSelect = document.getElementById('modelSelect');
        modelSelect.innerHTML = '<option value="">选择模型...</option>';
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            modelSelect.appendChild(option);
        });
    }
    
    setupAIExpandModal() {
        const modal = document.getElementById('aiExpandModal');
        const closeBtn = modal.querySelector('.close');
        const cancelBtn = document.getElementById('cancelAiExpandBtn');
        const executeBtn = document.getElementById('executeAiExpandBtn');
        
        closeBtn.addEventListener('click', () => modal.style.display = 'none');
        cancelBtn.addEventListener('click', () => modal.style.display = 'none');
        executeBtn.addEventListener('click', () => this.executeAIExpand());
    }
    
    onKeyDown(e) {
        // 如果正在编辑节点，不处理全局快捷键
        if (this.editingNode) {
            return;
        }
        
        // Enter键添加子节点
        if (e.key === 'Enter' && !e.shiftKey && this.selectedNode) {
            e.preventDefault();
            this.createNode('新节点', this.selectedNode);
            this.saveState();
            this.render();
        }
        
        // Shift+Enter添加兄弟节点
        if (e.key === 'Enter' && e.shiftKey && this.selectedNode) {
            e.preventDefault();
            if (this.selectedNode.parent) {
                this.createNode('新节点', this.selectedNode.parent);
                this.saveState();
                this.render();
            }
        }
        
        // Ctrl+Z 撤销
        if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            this.undo();
        }
        
        // Ctrl+Shift+Z 或 Ctrl+Y 重做
        if ((e.ctrlKey && e.shiftKey && e.key === 'Z') || (e.ctrlKey && e.key === 'y')) {
            e.preventDefault();
            this.redo();
        }
        
        // Delete键删除节点
        if (e.key === 'Delete' && this.selectedNode && !document.querySelector('.node-input')) {
            e.preventDefault();
            this.deleteNode(this.selectedNode);
            this.selectedNode = null;
            this.saveState();
        }
    }
    
    saveState() {
        const state = this.serializeState();
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(state);
        
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }
        
        this.updateUndoRedoButtons();
    }
    
    serializeState() {
        const nodesArray = Array.from(this.nodes.values()).map(node => ({
            id: node.id,
            text: node.text,
            x: node.x,
            y: node.y,
            width: node.width,
            height: node.height,
            parentId: node.parent ? node.parent.id : null,
            collapsed: node.collapsed
        }));
        
        return JSON.stringify({
            nodes: nodesArray,
            nextId: this.nextId,
            rootId: this.rootNode ? this.rootNode.id : null
        });
    }
    
    restoreState(stateStr) {
        const state = JSON.parse(stateStr);
        this.nodes.clear();
        this.nextId = state.nextId;
        
        const nodeMap = new Map();
        state.nodes.forEach(nodeData => {
            const node = {
                id: nodeData.id,
                text: nodeData.text,
                x: nodeData.x,
                y: nodeData.y,
                width: nodeData.width,
                height: nodeData.height,
                children: [],
                parent: null,
                collapsed: nodeData.collapsed
            };
            nodeMap.set(node.id, node);
            this.nodes.set(node.id, node);
        });
        
        state.nodes.forEach(nodeData => {
            const node = nodeMap.get(nodeData.id);
            if (nodeData.parentId) {
                const parent = nodeMap.get(nodeData.parentId);
                if (parent) {
                    node.parent = parent;
                    parent.children.push(node);
                }
            }
        });
        
        this.rootNode = nodeMap.get(state.rootId);
        this.selectedNode = null;
        this.render();
    }
    
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreState(this.history[this.historyIndex]);
            this.updateUndoRedoButtons();
        }
    }
    
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreState(this.history[this.historyIndex]);
            this.updateUndoRedoButtons();
        }
    }
    
    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        
        undoBtn.disabled = this.historyIndex <= 0;
        redoBtn.disabled = this.historyIndex >= this.history.length - 1;
        
        undoBtn.style.opacity = undoBtn.disabled ? '0.5' : '1';
        redoBtn.style.opacity = redoBtn.disabled ? '0.5' : '1';
    }
    
    createRootNode() {
        const node = {
            id: this.nextId++,
            text: '中心主题',
            x: 400,
            y: 300,
            width: 120,
            height: 50,
            children: [],
            parent: null,
            collapsed: false
        };
        this.nodes.set(node.id, node);
        this.rootNode = node;
    }
    
    createNode(text, parent) {
        const node = {
            id: this.nextId++,
            text: text,
            x: 0,
            y: 0,
            width: 120,
            height: 50,
            children: [],
            parent: parent,
            collapsed: false
        };
        
        if (parent) {
            parent.children.push(node);
        }
        
        this.nodes.set(node.id, node);
        this.updateNodeSize(node);
        this.calculateNodePositions();
        return node;
    }
    
    updateNodeSize(node) {
        // 根据文本内容计算节点大小
        const lines = node.text.split('\n');
        
        // 使用临时canvas精确测量文本宽度
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.font = '500 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        
        let maxWidth = 0;
        lines.forEach(line => {
            const metrics = ctx.measureText(line);
            maxWidth = Math.max(maxWidth, metrics.width);
        });
        
        const lineHeight = 20;
        const paddingX = 40; // 左右内边距
        const paddingY = 30; // 上下内边距
        
        node.width = Math.max(80, Math.ceil(maxWidth) + paddingX);
        node.height = Math.max(40, lines.length * lineHeight + paddingY);
    }
    
    deleteNode(node) {
        if (node === this.rootNode) {
            alert('无法删除根节点');
            return;
        }
        
        const deleteRecursive = (n) => {
            n.children.forEach(child => deleteRecursive(child));
            this.nodes.delete(n.id);
        };
        
        if (node.parent) {
            const index = node.parent.children.indexOf(node);
            if (index > -1) {
                node.parent.children.splice(index, 1);
            }
        }
        
        deleteRecursive(node);
        this.calculateNodePositions();
        this.render();
    }
    
    moveNode(node, newParent) {
        if (node === newParent || this.isDescendant(newParent, node) || node === this.rootNode) {
            return false;
        }
        
        if (node.parent) {
            const index = node.parent.children.indexOf(node);
            if (index > -1) {
                node.parent.children.splice(index, 1);
            }
        }
        
        node.parent = newParent;
        newParent.children.push(node);
        
        this.calculateNodePositions();
        return true;
    }
    
    isDescendant(node, ancestor) {
        let current = node;
        while (current) {
            if (current === ancestor) return true;
            current = current.parent;
        }
        return false;
    }
    
    calculateNodePositions() {
        if (!this.rootNode) return;
        
        const baseGap = 50; // 基础层级间距
        const siblingGap = 30; // 兄弟节点间距
        
        // 计算子树高度（包含所有子节点及其子树）
        const calculateSubtreeHeight = (node) => {
            if (node.collapsed || node.children.length === 0) {
                return node.height;
            }
            let totalHeight = 0;
            node.children.forEach(child => {
                totalHeight += calculateSubtreeHeight(child);
            });
            return totalHeight + (node.children.length - 1) * siblingGap;
        };
        
        // 定位节点
        const positionNode = (node, leftX, centerY) => {
            // 节点左对齐：左边缘X坐标相同，节点中心x = 左边缘 + 宽度/2
            node.x = leftX + node.width / 2;
            node.y = centerY;
            
            if (node.collapsed || node.children.length === 0) return;
            
            // 子节点的左边缘位置：父节点右边缘 + 基础间距
            const childLeftX = leftX + node.width + baseGap;
            
            // 计算所有子节点的总高度
            const totalChildrenHeight = calculateSubtreeHeight(node);
            
            // 从父节点中心向上下均匀分布子节点
            let currentY = centerY - totalChildrenHeight / 2;
            
            node.children.forEach(child => {
                const childSubtreeHeight = calculateSubtreeHeight(child);
                // 子节点的中心Y位置
                const childCenterY = currentY + childSubtreeHeight / 2;
                
                // 递归定位子节点
                positionNode(child, childLeftX, childCenterY);
                
                // 累加子树高度和间距
                currentY += childSubtreeHeight + siblingGap;
            });
        };
        
        // 根节点起始位置（左边缘）
        const rootLeftX = 350;
        const rootCenterY = 300;
        positionNode(this.rootNode, rootLeftX, rootCenterY);
    }
    
    render() {
        this.nodesGroup.innerHTML = '';
        this.linesGroup.innerHTML = '';
        
        // 绘制连接线 - 只绘制可见节点的连接线
        this.nodes.forEach(node => {
            if (node.parent && !this.isNodeHidden(node)) {
                this.drawConnection(node.parent, node);
            }
        });
        
        // 绘制节点
        this.nodes.forEach(node => {
            if (!node.parent || !this.isNodeHidden(node)) {
                this.drawNode(node);
            }
        });
        
        this.updateTransform();
    }
    
    isNodeHidden(node) {
        let current = node.parent;
        while (current) {
            if (current.collapsed) return true;
            current = current.parent;
        }
        return false;
    }
    
    getNodeDepth(node) {
        let depth = 0;
        let current = node.parent;
        while (current) {
            depth++;
            current = current.parent;
        }
        return depth;
    }
    
    countCollapsedNodes(node) {
        let count = 0;
        const countRecursive = (n) => {
            count += n.children.length;
            n.children.forEach(child => countRecursive(child));
        };
        countRecursive(node);
        return count;
    }
    
    drawNode(node) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.classList.add('node');
        g.dataset.nodeId = node.id;
        
        const depth = this.getNodeDepth(node);
        
        // 节点矩形（根据层级设置样式）
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.classList.add('node-rect');
        rect.setAttribute('x', node.x - node.width / 2);
        rect.setAttribute('y', node.y - node.height / 2);
        rect.setAttribute('width', node.width);
        rect.setAttribute('height', node.height);
        
        // 主节点和一级节点有圆角边框，其他节点无边框但有圆角
        if (depth <= 1) {
            rect.setAttribute('rx', '12');
            rect.setAttribute('ry', '12');
        } else {
            // 二级及以上节点：矩形透明但保留用于点击，hover时显示圆角边框
            rect.setAttribute('rx', '8');
            rect.setAttribute('ry', '8');
            rect.setAttribute('stroke', 'transparent');
            rect.setAttribute('fill', 'transparent');
            rect.setAttribute('stroke-width', '0');
            rect.style.pointerEvents = 'all';  // 确保可以捕获点击事件
            rect.classList.add('level-2-plus');
        }
        
        // 所有节点都可以有hover和selected状态
        if (node === this.selectedNode) {
            rect.classList.add('selected');
        }
        if (node === this.hoveredNode) {
            rect.classList.add('hover');
        }
        if (node.collapsed) {
            rect.classList.add('collapsed');
        }
        
        g.appendChild(rect);
        
        // 节点文本（根据层级设置不同样式）
        const lines = node.text.split('\n');
        const lineHeight = 20;
        const startY = node.y - ((lines.length - 1) * lineHeight) / 2;
        const textPaddingLeft = 20;
        
        lines.forEach((line, index) => {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.classList.add('node-text');
            
            if (depth <= 1) {
                // 主节点(depth=0)和一级节点(depth=1)：居中对齐
                text.setAttribute('x', node.x);
                text.setAttribute('y', startY + index * lineHeight);
                text.setAttribute('text-anchor', 'middle');
                text.textContent = this.truncateText(line, node.width - 20);
            } else {
                // 二级及以上节点：左对齐
                text.setAttribute('x', node.x - node.width / 2 + textPaddingLeft);
                text.setAttribute('y', startY + index * lineHeight);
                text.setAttribute('text-anchor', 'start');
                text.textContent = this.truncateText(line, node.width - textPaddingLeft * 2);
            }
            
            g.appendChild(text);
        });
        
        // 折叠按钮或添加按钮
        if (node.children.length > 0) {
            const collapseBtn = this.createCollapseButton(node);
            g.appendChild(collapseBtn);
        } else {
            const addBtn = this.createAddButton(node);
            g.appendChild(addBtn);
        }
        
        // 事件监听
        g.addEventListener('mouseenter', () => this.onNodeMouseEnter(node));
        g.addEventListener('mouseleave', () => this.onNodeMouseLeave(node));
        g.addEventListener('mousedown', (e) => this.onNodeMouseDown(node, e));
        
        // 双击编辑 - 直接绑定
        g.addEventListener('dblclick', (e) => {
            const target = e.target;
            const isButton = target.classList.contains('collapse-button') || 
                           target.classList.contains('collapse-icon') ||
                           target.classList.contains('add-button-group') ||
                           target.closest('.collapse-button-group') ||
                           target.closest('.add-button-group');
            
            if (!isButton) {
                e.stopPropagation();
                e.preventDefault();
                this.startEditNode(node);
            }
        });
        
        this.nodesGroup.appendChild(g);
    }
    
    createCollapseButton(node) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.style.cursor = 'pointer';
        g.classList.add('collapse-button-group');
        const btnSize = 20;
        const btnX = node.x + node.width / 2;  // 紧贴节点右边缘
        const btnY = node.y - btnSize / 2;
        
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.classList.add('collapse-button');
        rect.setAttribute('x', btnX);
        rect.setAttribute('y', btnY);
        rect.setAttribute('width', btnSize);
        rect.setAttribute('height', btnSize);
        
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        icon.classList.add('collapse-icon');
        icon.setAttribute('x', btnX + btnSize / 2);
        icon.setAttribute('y', btnY + btnSize / 2);
        icon.setAttribute('text-anchor', 'middle');
        icon.setAttribute('dominant-baseline', 'middle');
        icon.setAttribute('font-size', '16');
        icon.setAttribute('font-weight', 'bold');
        
        // 折叠时显示+号，展开时显示-号
        if (node.collapsed) {
            icon.textContent = '+';
            rect.style.fill = '#fff3e0';
            rect.style.stroke = '#FF9800';
        } else {
            icon.textContent = '−';
        }
        
        g.appendChild(rect);
        g.appendChild(icon);
        
        // 折叠时显示子节点数量
        if (node.collapsed) {
            const count = this.countCollapsedNodes(node);
            const countText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            countText.classList.add('collapse-count');
            countText.setAttribute('x', btnX + btnSize + 5);
            countText.setAttribute('y', btnY + btnSize / 2);
            countText.setAttribute('text-anchor', 'start');
            countText.setAttribute('dominant-baseline', 'central');
            countText.setAttribute('font-size', '12');
            countText.setAttribute('font-weight', '600');
            countText.textContent = count;
            countText.style.fill = '#FF9800';
            g.appendChild(countText);
        }
        
        g.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.toggleNodeCollapse(node);
        });
        
        g.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });
        
        // 悬停效果
        g.addEventListener('mouseenter', () => {
            rect.style.fill = node.collapsed ? '#ffe0b2' : '#f0f0f0';
            rect.style.stroke = node.collapsed ? '#F57C00' : '#666';
        });
        
        g.addEventListener('mouseleave', () => {
            rect.style.fill = node.collapsed ? '#fff3e0' : 'white';
            rect.style.stroke = node.collapsed ? '#FF9800' : '#999';
        });
        
        return g;
    }
    
    createAddButton(node) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.style.cursor = 'pointer';
        g.classList.add('add-button-group');
        const btnSize = 20;
        const btnX = node.x + node.width / 2;  // 紧贴节点右边缘
        const btnY = node.y - btnSize / 2;
        
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.classList.add('collapse-button');
        rect.setAttribute('x', btnX);
        rect.setAttribute('y', btnY);
        rect.setAttribute('width', btnSize);
        rect.setAttribute('height', btnSize);
        rect.style.fill = '#e8f5e9';
        rect.style.stroke = '#4CAF50';
        
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        icon.classList.add('collapse-icon');
        icon.setAttribute('x', btnX + btnSize / 2);
        icon.setAttribute('y', btnY + btnSize / 2);
        icon.setAttribute('text-anchor', 'middle');
        icon.setAttribute('dominant-baseline', 'middle');
        icon.setAttribute('font-size', '16');
        icon.setAttribute('font-weight', 'bold');
        icon.textContent = '+';
        icon.style.fill = '#4CAF50';
        
        g.appendChild(rect);
        g.appendChild(icon);
        
        g.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.createNode('新节点', node);
            this.saveState();
            this.render();
        });
        
        g.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });
        
        // 悬停效果
        g.addEventListener('mouseenter', () => {
            rect.style.fill = '#c8e6c9';
            rect.style.stroke = '#388E3C';
        });
        
        g.addEventListener('mouseleave', () => {
            rect.style.fill = '#e8f5e9';
            rect.style.stroke = '#4CAF50';
        });
        
        return g;
    }
    
    drawConnection(parent, child) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        line.classList.add('connection-line');
        
        const startX = parent.x + parent.width / 2;
        const startY = parent.y;
        const endX = child.x - child.width / 2;
        const endY = child.y;
        
        const midX = (startX + endX) / 2;
        const d = `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;
        line.setAttribute('d', d);
        
        this.linesGroup.appendChild(line);
    }
    
    truncateText(text, maxWidth) {
        const maxChars = Math.floor(maxWidth / 8);
        if (text.length > maxChars) {
            return text.substring(0, maxChars - 3) + '...';
        }
        return text;
    }
    
    toggleNodeCollapse(node) {
        node.collapsed = !node.collapsed;
        this.calculateNodePositions();
        this.saveState();
        this.render();
    }
    
    onNodeMouseEnter(node) {
        this.hoveredNode = node;
        const nodeElement = document.querySelector(`[data-node-id="${node.id}"] .node-rect`);
        if (nodeElement && node !== this.selectedNode) {
            nodeElement.classList.add('hover');
        }
    }
    
    onNodeMouseLeave(node) {
        if (this.hoveredNode === node) {
            this.hoveredNode = null;
            const nodeElement = document.querySelector(`[data-node-id="${node.id}"] .node-rect`);
            if (nodeElement) {
                nodeElement.classList.remove('hover');
            }
        }
    }
    
    onNodeMouseDown(node, e) {
        if (e.button === 0 && !e.target.closest('.collapse-button') && !e.target.closest('.add-button-group')) {
            e.stopPropagation();
            
            // 移除之前选中节点的样式
            if (this.selectedNode) {
                const oldElement = document.querySelector(`[data-node-id="${this.selectedNode.id}"] .node-rect`);
                if (oldElement) {
                    oldElement.classList.remove('selected');
                }
            }
            
            this.selectedNode = node;
            
            // 添加选中样式
            const nodeElement = document.querySelector(`[data-node-id="${node.id}"] .node-rect`);
            if (nodeElement) {
                nodeElement.classList.add('selected');
            }
            
            // 准备拖拽
            this.draggedNode = node;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            
            // 监听鼠标移动和释放
            const onMouseMove = (moveEvent) => {
                const dx = moveEvent.clientX - this.dragStartX;
                const dy = moveEvent.clientY - this.dragStartY;
                
                // 移动距离超过5px才开始拖拽
                if (!this.isDraggingNode && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
                    this.startDragging(node, moveEvent);
                }
                
                if (this.isDraggingNode) {
                    this.onDragMove(moveEvent);
                }
            };
            
            const onMouseUp = () => {
                if (this.isDraggingNode) {
                    this.endDragging();
                }
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };
            
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        }
    }
    
    startEditNode(node) {
        // 清除已存在的编辑元素
        const oldEditor = document.querySelector('.node-editing');
        if (oldEditor) {
            this.finishEdit();
        }
        
        // 保存正在编辑的节点引用
        this.editingNode = node;
        
        // 标记节点为编辑状态
        node.isEditing = true;
        
        // 重新渲染以显示编辑器
        this.renderEditingNode(node);
        
        // 聚焦并选中文本
        setTimeout(() => {
            const editor = document.querySelector('.inline-editor');
            if (editor) {
                editor.focus();
                const range = document.createRange();
                range.selectNodeContents(editor);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }, 50);
    }
    
    renderEditingNode(node) {
        // 找到节点的DOM元素
        const nodeGroup = document.querySelector(`[data-node-id="${node.id}"]`);
        if (!nodeGroup) return;
        
        // 隐藏原始文本
        const textElements = nodeGroup.querySelectorAll('.node-text');
        textElements.forEach(el => el.style.display = 'none');
        
        // 创建SVG foreignObject来嵌入HTML编辑器
        const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
        foreignObject.classList.add('node-editing');
        
        // 根据当前文本长度动态设置编辑器大小
        const minWidth = 150;
        const minHeight = 60;
        foreignObject.setAttribute('x', node.x - Math.max(node.width, minWidth) / 2);
        foreignObject.setAttribute('y', node.y - Math.max(node.height, minHeight) / 2);
        foreignObject.setAttribute('width', Math.max(node.width, minWidth));
        foreignObject.setAttribute('height', Math.max(node.height, minHeight));
        
        // 创建contenteditable的div
        const editor = document.createElement('div');
        editor.contentEditable = 'true';
        editor.className = 'inline-editor';
        editor.textContent = node.text;
        editor.style.cssText = `
            width: 100%;
            height: 100%;
            min-width: ${minWidth}px;
            min-height: ${minHeight}px;
            padding: 15px;
            font-size: 14px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-weight: 500;
            line-height: 1.4;
            color: #333;
            background: white;
            border: 2px solid #667eea;
            border-radius: 12px;
            outline: none;
            overflow: auto;
            box-sizing: border-box;
            white-space: pre-wrap;
            word-wrap: break-word;
        `;
        
        foreignObject.appendChild(editor);
        nodeGroup.appendChild(foreignObject);
        
        this.editingEditor = editor;
        
        // 输入时只更新文本，不触发重新渲染（避免卡顿）
        editor.addEventListener('input', () => {
            node.text = editor.textContent;
            this.checkAndWrapText(editor);
        });
        
        // 按键处理
        editor.addEventListener('keydown', (e) => {
            // 阻止事件冒泡到document，避免触发全局快捷键
            e.stopPropagation();
            
            if (e.key === 'Escape') {
                e.preventDefault();
                this.cancelEdit();
            } else if (e.key === 'Enter') {
                if (e.shiftKey) {
                    // Shift+Enter 换行，不阻止默认行为
                    return;
                } else {
                    // 普通Enter完成编辑
                    e.preventDefault();
                    this.finishEdit();
                }
            }
        });
    }
    
    
    finishEdit() {
        if (!this.editingNode || !this.editingEditor) return;
        
        const newText = this.editingEditor.textContent.trim();
        if (newText) {
            this.editingNode.text = newText;
        } else {
            // 如果文本为空，使用默认文本
            this.editingNode.text = '新节点';
        }
        
        this.editingNode.isEditing = false;
        
        // 更新节点大小和布局
        this.updateNodeSize(this.editingNode);
        this.calculateNodePositions();
        
        this.editingNode = null;
        this.editingEditor = null;
        
        // 保存状态并重新渲染
        this.saveState();
        this.render();
    }
    
    checkAndWrapText(editor) {
        const text = editor.textContent;
        const lines = text.split('\n');
        let modified = false;
        
        const wrappedLines = lines.map(line => {
            if (line.length > 35) {
                modified = true;
                // 每35个字符插入换行
                const wrapped = [];
                for (let i = 0; i < line.length; i += 35) {
                    wrapped.push(line.substring(i, i + 35));
                }
                return wrapped.join('\n');
            }
            return line;
        });
        
        if (modified) {
            const newText = wrappedLines.join('\n');
            const cursorPos = this.getCaretPosition(editor);
            editor.textContent = newText;
            this.setCaretPosition(editor, Math.min(cursorPos, newText.length));
        }
    }
    
    getCaretPosition(element) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const preCaretRange = range.cloneRange();
            preCaretRange.selectNodeContents(element);
            preCaretRange.setEnd(range.endContainer, range.endOffset);
            return preCaretRange.toString().length;
        }
        return 0;
    }
    
    setCaretPosition(element, position) {
        const range = document.createRange();
        const selection = window.getSelection();
        
        let currentPos = 0;
        let found = false;
        
        const setPosition = (node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const textLength = node.textContent.length;
                if (currentPos + textLength >= position) {
                    range.setStart(node, position - currentPos);
                    range.collapse(true);
                    found = true;
                    return true;
                }
                currentPos += textLength;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                for (let i = 0; i < node.childNodes.length; i++) {
                    if (setPosition(node.childNodes[i])) {
                        return true;
                    }
                }
            }
            return false;
        };
        
        setPosition(element);
        
        if (found) {
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }
    
    cancelEdit() {
        if (this.editingNode) {
            this.editingNode.isEditing = false;
            
            // 恢复原始文本
            const originalText = this.editingNode.text;
            this.editingNode.text = originalText;
        }
        
        this.editingNode = null;
        this.editingEditor = null;
        
        // 完整重新渲染
        this.render();
    }
    
    startDragging(node, e) {
        this.isDraggingNode = true;
        this.draggedNode = node;
        
        // 创建拖拽预览
        this.createDragPreview(node, e);
        
        // 标记被拖拽节点
        const nodeElement = document.querySelector(`[data-node-id="${node.id}"]`);
        if (nodeElement) {
            nodeElement.style.opacity = '0.5';
        }
        
        document.body.style.cursor = 'grabbing';
    }
    
    createDragPreview(node, e) {
        // 创建一个半透明的预览元素
        const preview = document.createElement('div');
        preview.className = 'drag-preview';
        preview.textContent = node.text;
        preview.style.cssText = `
            position: fixed;
            left: ${e.clientX}px;
            top: ${e.clientY}px;
            padding: 10px 20px;
            background: rgba(102, 126, 234, 0.8);
            color: white;
            border-radius: 8px;
            pointer-events: none;
            z-index: 10000;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            transform: translate(-50%, -50%);
        `;
        document.body.appendChild(preview);
        this.dragPreview = preview;
    }
    
    onDragMove(e) {
        // 更新预览位置
        if (this.dragPreview) {
            this.dragPreview.style.left = e.clientX + 'px';
            this.dragPreview.style.top = e.clientY + 'px';
        }
        
        // 检查鼠标下的节点
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        let targetNode = null;
        
        for (const el of elements) {
            const nodeGroup = el.closest('.node');
            if (nodeGroup) {
                const nodeId = parseInt(nodeGroup.dataset.nodeId);
                const node = this.nodes.get(nodeId);
                
                // 不能拖到自己或自己的子节点
                if (node && node !== this.draggedNode && !this.isDescendant(node, this.draggedNode)) {
                    targetNode = node;
                    break;
                }
            }
        }
        
        // 更新drop目标
        if (targetNode !== this.dropTargetNode) {
            // 移除旧目标的高亮
            if (this.dropTargetNode) {
                const oldTarget = document.querySelector(`[data-node-id="${this.dropTargetNode.id}"] .node-rect`);
                if (oldTarget) {
                    oldTarget.classList.remove('drop-target');
                }
            }
            
            this.dropTargetNode = targetNode;
            
            // 添加新目标的高亮
            if (this.dropTargetNode) {
                const newTarget = document.querySelector(`[data-node-id="${this.dropTargetNode.id}"] .node-rect`);
                if (newTarget) {
                    newTarget.classList.add('drop-target');
                }
            }
        }
    }
    
    endDragging() {
        // 移除预览
        if (this.dragPreview) {
            this.dragPreview.remove();
            this.dragPreview = null;
        }
        
        // 恢复被拖拽节点的透明度
        const nodeElement = document.querySelector(`[data-node-id="${this.draggedNode.id}"]`);
        if (nodeElement) {
            nodeElement.style.opacity = '';
        }
        
        // 如果有drop目标，执行移动
        if (this.dropTargetNode) {
            this.moveNodeTo(this.draggedNode, this.dropTargetNode);
            
            // 移除drop目标高亮
            const targetElement = document.querySelector(`[data-node-id="${this.dropTargetNode.id}"] .node-rect`);
            if (targetElement) {
                targetElement.classList.remove('drop-target');
            }
        }
        
        // 重置状态
        this.isDraggingNode = false;
        this.draggedNode = null;
        this.dropTargetNode = null;
        document.body.style.cursor = '';
    }
    
    isDescendant(node, ancestor) {
        let current = node.parent;
        while (current) {
            if (current === ancestor) return true;
            current = current.parent;
        }
        return false;
    }
    
    moveNodeTo(node, newParent) {
        // 不能移动根节点
        if (node === this.rootNode) return;
        
        // 从旧父节点移除
        if (node.parent) {
            const index = node.parent.children.indexOf(node);
            if (index > -1) {
                node.parent.children.splice(index, 1);
            }
        }
        
        // 添加到新父节点
        node.parent = newParent;
        newParent.children.push(node);
        
        // 重新计算布局并渲染
        this.calculateNodePositions();
        this.saveState();
        this.render();
    }
    
    onCanvasMouseDown(e) {
        if (e.button === 0) {
            const target = e.target;
            
            // 点击空白处完成编辑
            if (this.editingNode && !target.closest('.inline-editor') && !target.closest('.node')) {
                this.finishEdit();
            }
            
            if (target === this.canvasContainer || target === this.canvas || target.tagName === 'g') {
                this.isDragging = true;
                this.dragStartX = e.clientX - this.translateX;
                this.dragStartY = e.clientY - this.translateY;
                this.canvasContainer.classList.add('dragging');
                e.preventDefault();
            }
        }
    }
    
    onCanvasMouseMove(e) {
        if (this.isDragging && !this.isDraggingNode) {
            this.translateX = e.clientX - this.dragStartX;
            this.translateY = e.clientY - this.dragStartY;
            this.updateTransform();
        }
    }
    
    onCanvasMouseUp(e) {
        if (this.isDragging) {
            this.isDragging = false;
            this.canvasContainer.classList.remove('dragging');
        }
    }
    
    onCanvasWheel(e) {
        e.preventDefault();
        
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(0.1, Math.min(3, this.scale * delta));
        
        const rect = this.canvasContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const worldX = (mouseX - this.translateX) / this.scale;
        const worldY = (mouseY - this.translateY) / this.scale;
        
        this.scale = newScale;
        this.translateX = mouseX - worldX * this.scale;
        this.translateY = mouseY - worldY * this.scale;
        
        this.updateTransform();
    }
    
    updateTransform() {
        this.nodesGroup.setAttribute('transform', 
            `translate(${this.translateX}, ${this.translateY}) scale(${this.scale})`);
        this.linesGroup.setAttribute('transform', 
            `translate(${this.translateX}, ${this.translateY}) scale(${this.scale})`);
    }
    
    resetView() {
        this.scale = 1;
        this.translateX = 0;
        this.translateY = 0;
        this.updateTransform();
    }
    
    showDragTooltip(x, y) {
        let tooltip = document.getElementById('dragTooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'dragTooltip';
            tooltip.className = 'drag-tooltip';
            document.body.appendChild(tooltip);
        }
        
        if (this.dropTargetNode) {
            tooltip.textContent = `✓ 松开鼠标将节点移动到 "${this.dropTargetNode.text}"`;
            tooltip.style.background = '#4CAF50';
        } else {
            tooltip.textContent = '将节点拖动到目标节点上';
            tooltip.style.background = '#666';
        }
        
        tooltip.style.left = (x + 15) + 'px';
        tooltip.style.top = (y + 15) + 'px';
        tooltip.style.display = 'block';
    }
    
    hideDragTooltip() {
        const tooltip = document.getElementById('dragTooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }
    
    showMoveSuccessIndicator(targetNode) {
        const indicator = document.createElement('div');
        indicator.className = 'move-success-indicator';
        indicator.textContent = '✓ 节点已移动';
        
        const rect = this.canvasContainer.getBoundingClientRect();
        const x = (targetNode.x * this.scale + this.translateX + rect.left);
        const y = (targetNode.y * this.scale + this.translateY + rect.top);
        
        indicator.style.left = x + 'px';
        indicator.style.top = (y - 40) + 'px';
        
        document.body.appendChild(indicator);
        
        setTimeout(() => {
            indicator.style.opacity = '0';
            setTimeout(() => indicator.remove(), 300);
        }, 1500);
    }
    
    onContextMenu(e) {
        e.preventDefault();
        
        const target = e.target.closest('.node');
        if (target) {
            const nodeId = parseInt(target.dataset.nodeId);
            const node = this.nodes.get(nodeId);
            if (node) {
                this.selectedNode = node;
                this.showContextMenu(e.clientX, e.clientY);
                this.render();
            }
        }
    }
    
    showContextMenu(x, y) {
        this.contextMenu.style.display = 'block';
        this.contextMenu.style.left = x + 'px';
        this.contextMenu.style.top = y + 'px';
    }
    
    hideContextMenu() {
        this.contextMenu.style.display = 'none';
    }
    
    handleContextMenuAction(action) {
        if (!this.selectedNode) return;
        
        this.hideContextMenu();
        
        switch (action) {
            case 'addChild':
                this.createNode('新节点', this.selectedNode);
                this.saveState();
                this.render();
                break;
            case 'addSibling':
                if (this.selectedNode.parent) {
                    this.createNode('新节点', this.selectedNode.parent);
                    this.saveState();
                    this.render();
                }
                break;
            case 'delete':
                this.deleteNode(this.selectedNode);
                this.selectedNode = null;
                this.saveState();
                break;
            case 'aiExpand':
                this.showAIExpandModal();
                break;
        }
    }
    
    showSettingsModal() {
        document.getElementById('settingsModal').style.display = 'flex';
    }
    
    loadAISettingsToForm() {
        document.getElementById('apiProvider').value = this.aiConfig.provider || 'deepseek';
        document.getElementById('apiKey').value = this.aiConfig.apiKey || '';
        document.getElementById('customUrl').value = this.aiConfig.customUrl || '';
        document.getElementById('modelName').value = this.aiConfig.modelName || '';
        
        document.getElementById('customUrlGroup').style.display = 
            this.aiConfig.provider === 'custom' ? 'block' : 'none';
    }
    
    async loadAvailableModels() {
        const provider = document.getElementById('apiProvider').value;
        const apiKey = document.getElementById('apiKey').value.trim();
        const statusDiv = document.getElementById('modelLoadingStatus');
        const modelSelect = document.getElementById('modelSelect');
        
        if (!apiKey) return;
        
        statusDiv.className = 'model-loading-status loading';
        statusDiv.textContent = '🔄 正在加载可用模型...';
        
        try {
            let models = [];
            
            if (provider === 'openrouter') {
                const response = await fetch('https://openrouter.ai/api/v1/models', {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    models = data.data.map(m => m.id);
                }
            } else if (provider === 'deepseek') {
                models = ['deepseek-chat', 'deepseek-coder'];
            } else if (provider === 'gemini') {
                models = ['gemini-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'];
            }
            
            this.availableModels = models;
            this.updateModelSelect(models);
            
            statusDiv.className = 'model-loading-status success';
            statusDiv.textContent = `✅ 已加载 ${models.length} 个模型`;
            
            modelSelect.style.display = 'block';
            
            setTimeout(() => {
                statusDiv.className = 'model-loading-status';
            }, 3000);
            
        } catch (error) {
            statusDiv.className = 'model-loading-status error';
            statusDiv.textContent = '❌ 加载模型失败';
            
            setTimeout(() => {
                statusDiv.className = 'model-loading-status';
            }, 3000);
        }
    }
    
    saveAISettings() {
        const provider = document.getElementById('apiProvider').value;
        const apiKey = document.getElementById('apiKey').value;
        const customUrl = document.getElementById('customUrl').value;
        const modelName = document.getElementById('modelName').value;
        
        this.aiConfig = { provider, apiKey, customUrl, modelName };
        localStorage.setItem('aiConfig', JSON.stringify(this.aiConfig));
        
        document.getElementById('settingsModal').style.display = 'none';
        alert('AI设置已保存');
    }
    
    loadAIConfig() {
        const saved = localStorage.getItem('aiConfig');
        if (saved) {
            return JSON.parse(saved);
        }
        return {
            provider: 'deepseek',
            apiKey: '',
            customUrl: '',
            modelName: 'deepseek-chat'
        };
    }
    
    showAIExpandModal() {
        const modal = document.getElementById('aiExpandModal');
        const referenceList = document.getElementById('nodeReferenceList');
        
        referenceList.innerHTML = '';
        this.nodes.forEach(node => {
            const item = document.createElement('div');
            item.className = 'node-reference-item';
            item.innerHTML = `<code>@${node.text}</code>`;
            item.addEventListener('click', () => {
                const prompt = document.getElementById('aiPrompt');
                prompt.value += ` @${node.text}`;
                prompt.focus();
            });
            referenceList.appendChild(item);
        });
        
        document.getElementById('aiPrompt').value = '';
        document.getElementById('aiExpandStatus').className = 'ai-status';
        document.getElementById('aiExpandStatus').textContent = '';
        
        modal.style.display = 'flex';
    }
    
    async executeAIExpand() {
        const prompt = document.getElementById('aiPrompt').value.trim();
        const statusDiv = document.getElementById('aiExpandStatus');
        
        if (!prompt) {
            alert('请输入提示词');
            return;
        }
        
        if (!this.aiConfig.apiKey) {
            alert('请先配置AI API设置');
            return;
        }
        
        if (!this.selectedNode) {
            alert('请先选择一个节点');
            return;
        }
        
        statusDiv.className = 'ai-status loading';
        statusDiv.textContent = '🔄 正在调用AI生成内容...';
        
        try {
            let processedPrompt = prompt;
            this.nodes.forEach(node => {
                const pattern = new RegExp(`@${node.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
                processedPrompt = processedPrompt.replace(pattern, `"${node.text}"`);
            });
            
            const response = await this.callAI(processedPrompt);
            
            // 解析AI响应，替换选中节点的内容
            this.parseAIResponseAndReplaceNode(response, this.selectedNode);
            
            statusDiv.className = 'ai-status success';
            statusDiv.textContent = '✅ AI扩展完成！';
            
            this.saveState();
            
            setTimeout(() => {
                document.getElementById('aiExpandModal').style.display = 'none';
            }, 1500);
            
        } catch (error) {
            statusDiv.className = 'ai-status error';
            statusDiv.textContent = '❌ 错误: ' + error.message;
        }
    }
    
    async callAI(prompt) {
        const { provider, apiKey, customUrl, modelName } = this.aiConfig;
        
        let url, headers, body;
        
        switch (provider) {
            case 'deepseek':
                url = 'https://api.deepseek.com/v1/chat/completions';
                headers = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                };
                body = {
                    model: modelName || 'deepseek-chat',
                    messages: [{
                        role: 'user',
                        content: `请根据以下提示生成思维导图。返回JSON格式，包含一个主节点对象，有text和children字段，children是子节点数组。\n\n${prompt}`
                    }]
                };
                break;
                
            case 'gemini':
                url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName || 'gemini-pro'}:generateContent?key=${apiKey}`;
                headers = {
                    'Content-Type': 'application/json'
                };
                body = {
                    contents: [{
                        parts: [{
                            text: `请根据以下提示生成思维导图。返回JSON格式，包含一个主节点对象，有text和children字段，children是子节点数组。\n\n${prompt}`
                        }]
                    }]
                };
                break;
                
            case 'openrouter':
                url = 'https://openrouter.ai/api/v1/chat/completions';
                headers = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                };
                body = {
                    model: modelName || 'openai/gpt-3.5-turbo',
                    messages: [{
                        role: 'user',
                        content: `请根据以下提示生成思维导图。返回JSON格式，包含一个主节点对象，有text和children字段，children是子节点数组。\n\n${prompt}`
                    }]
                };
                break;
                
            case 'custom':
                url = customUrl;
                headers = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                };
                body = {
                    model: modelName,
                    messages: [{
                        role: 'user',
                        content: `请根据以下提示生成思维导图。返回JSON格式，包含一个主节点对象，有text和children字段，children是子节点数组。\n\n${prompt}`
                    }]
                };
                break;
        }
        
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status}`);
        }
        
        const data = await response.json();
        
        let content;
        if (provider === 'gemini') {
            content = data.candidates[0].content.parts[0].text;
        } else {
            content = data.choices[0].message.content;
        }
        
        return content;
    }
    
    parseAIResponseAndReplaceNode(response, targetNode) {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const data = JSON.parse(jsonMatch[0]);
                
                // 替换节点文本
                if (data.text) {
                    targetNode.text = data.text;
                    this.updateNodeSize(targetNode);
                }
                
                // 清空现有子节点
                targetNode.children.forEach(child => {
                    this.deleteNodeWithoutRender(child);
                });
                targetNode.children = [];
                
                // 创建新的子节点
                if (data.children && Array.isArray(data.children)) {
                    this.createNodesFromArray(data.children, targetNode);
                }
                
                this.calculateNodePositions();
                this.render();
                return;
            }
            
            // 降级处理
            const lines = response.split('\n').filter(line => line.trim());
            if (lines.length > 0) {
                targetNode.text = lines[0].replace(/^[-*•]\s*/, '').trim();
                this.updateNodeSize(targetNode);
                
                targetNode.children.forEach(child => {
                    this.deleteNodeWithoutRender(child);
                });
                targetNode.children = [];
                
                lines.slice(1).forEach(line => {
                    const text = line.replace(/^[-*•]\s*/, '').trim();
                    if (text) {
                        this.createNode(text, targetNode);
                    }
                });
            }
            
        } catch (error) {
            console.error('解析AI响应失败:', error);
        }
        
        this.calculateNodePositions();
        this.render();
    }
    
    deleteNodeWithoutRender(node) {
        const deleteRecursive = (n) => {
            n.children.forEach(child => deleteRecursive(child));
            this.nodes.delete(n.id);
        };
        deleteRecursive(node);
    }
    
    createNodesFromArray(nodesArray, parentNode) {
        nodesArray.forEach(nodeData => {
            const newNode = this.createNode(nodeData.text, parentNode);
            if (nodeData.children && Array.isArray(nodeData.children)) {
                this.createNodesFromArray(nodeData.children, newNode);
            }
        });
    }
    
    exportMarkdown() {
        const markdown = this.generateMarkdown(this.rootNode, 0);
        this.downloadFile('mindmap.md', markdown, 'text/markdown');
    }
    
    generateMarkdown(node, level) {
        let md = '#'.repeat(level + 1) + ' ' + node.text + '\n\n';
        if (!node.collapsed) {
            node.children.forEach(child => {
                md += this.generateMarkdown(child, level + 1);
            });
        }
        return md;
    }
    
    exportTxt() {
        const txt = this.generateTxt(this.rootNode, 0);
        this.downloadFile('mindmap.txt', txt, 'text/plain');
    }
    
    generateTxt(node, level) {
        let txt = '  '.repeat(level) + '- ' + node.text + '\n';
        if (!node.collapsed) {
            node.children.forEach(child => {
                txt += this.generateTxt(child, level + 1);
            });
        }
        return txt;
    }
    
    exportHtml() {
        const svgContent = this.generateSVGForExport();
        
        const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>思维导图 - ${this.rootNode.text}</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        .mindmap-container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
            padding: 20px;
            max-width: 95vw;
            max-height: 95vh;
            overflow: auto;
        }
        svg {
            display: block;
        }
    </style>
</head>
<body>
    <div class="mindmap-container">
        ${svgContent}
    </div>
</body>
</html>`;
        this.downloadFile('mindmap.html', html, 'text/html');
    }
    
    generateSVGForExport() {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        this.nodes.forEach(node => {
            if (!this.isNodeHidden(node)) {
                minX = Math.min(minX, node.x - node.width / 2);
                minY = Math.min(minY, node.y - node.height / 2);
                maxX = Math.max(maxX, node.x + node.width / 2);
                maxY = Math.max(maxY, node.y + node.height / 2);
            }
        });
        
        const padding = 50;
        const width = maxX - minX + padding * 2;
        const height = maxY - minY + padding * 2;
        const offsetX = -minX + padding;
        const offsetY = -minY + padding;
        
        let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
        svg += '<style>';
        svg += '.node-rect { fill: white; stroke: #ddd; stroke-width: 2; }';
        svg += '.node-rect.collapsed { fill: #f5f5f5; }';
        svg += '.node-text { fill: #333; font-size: 14px; font-weight: 500; text-anchor: middle; dominant-baseline: central; }';
        svg += '.connection-line { stroke: #d0d0d0; stroke-width: 2; fill: none; }';
        svg += '.collapse-button { fill: white; stroke: #999; stroke-width: 2; }';
        svg += '.collapse-icon { fill: #666; }';
        svg += '.collapse-count { fill: #999; font-size: 11px; }';
        svg += '</style>';
        
        svg += `<g transform="translate(${offsetX}, ${offsetY})">`;
        
        this.nodes.forEach(node => {
            if (node.parent && !node.parent.collapsed && !this.isNodeHidden(node)) {
                const parent = node.parent;
                const startX = parent.x + parent.width / 2;
                const startY = parent.y;
                const endX = node.x - node.width / 2;
                const endY = node.y;
                const midX = (startX + endX) / 2;
                
                svg += `<path class="connection-line" d="M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}"/>`;
            }
        });
        
        this.nodes.forEach(node => {
            if (!this.isNodeHidden(node)) {
                const x = node.x - node.width / 2;
                const y = node.y - node.height / 2;
                
                svg += `<rect class="node-rect${node.collapsed ? ' collapsed' : ''}" x="${x}" y="${y}" width="${node.width}" height="${node.height}" rx="12" ry="12"/>`;
                
                const lines = node.text.split('\n');
                const lineHeight = 20;
                const startY = node.y - ((lines.length - 1) * lineHeight) / 2;
                
                lines.forEach((line, index) => {
                    svg += `<text class="node-text" x="${node.x}" y="${startY + index * lineHeight}">${this.escapeHtml(this.truncateText(line, node.width - 20))}</text>`;
                });
                
                if (node.children.length > 0) {
                    const btnSize = 20;
                    const btnX = node.x + node.width / 2 + 5;
                    const btnY = node.y - btnSize / 2;
                    
                    if (node.collapsed) {
                        svg += `<rect class="collapse-button" x="${btnX}" y="${btnY}" width="${btnSize}" height="${btnSize}" rx="8" ry="8" style="fill: #fff3e0; stroke: #FF9800;"/>`;
                        svg += `<text class="collapse-icon" x="${btnX + btnSize / 2}" y="${btnY + btnSize / 2}" text-anchor="middle" dominant-baseline="middle" font-size="16" font-weight="bold">+</text>`;
                        const count = this.countCollapsedNodes(node);
                        svg += `<text class="collapse-count" x="${btnX + btnSize + 5}" y="${btnY + btnSize / 2}" text-anchor="start" dominant-baseline="central" font-size="12" font-weight="600" style="fill: #FF9800;">${count}</text>`;
                    } else {
                        svg += `<rect class="collapse-button" x="${btnX}" y="${btnY}" width="${btnSize}" height="${btnSize}" rx="8" ry="8"/>`;
                        svg += `<text class="collapse-icon" x="${btnX + btnSize / 2}" y="${btnY + btnSize / 2}" text-anchor="middle" dominant-baseline="middle" font-size="16" font-weight="bold">−</text>`;
                    }
                } else {
                    const btnSize = 20;
                    const btnX = node.x + node.width / 2 + 5;
                    const btnY = node.y - btnSize / 2;
                    
                    svg += `<rect class="collapse-button" x="${btnX}" y="${btnY}" width="${btnSize}" height="${btnSize}" rx="8" ry="8" style="fill: #e8f5e9; stroke: #4CAF50;"/>`;
                    svg += `<text class="collapse-icon" x="${btnX + btnSize / 2}" y="${btnY + btnSize / 2}" text-anchor="middle" dominant-baseline="middle" font-size="16" font-weight="bold" style="fill: #4CAF50;">+</text>`;
                }
            }
        });
        
        svg += '</g></svg>';
        return svg;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    downloadFile(filename, content, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// GitHub同步管理类
class GitHubSync {
    constructor() {
        this.username = null;
        this.repo = null;
        this.token = null;
        this.isLoggedIn = false;
        this.fileName = 'mindmap-data.json';
    }
    
    async login(username, repo, token) {
        this.username = username;
        this.repo = repo;
        this.token = token;
        
        // 验证token
        try {
            const response = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (response.ok) {
                const user = await response.json();
                this.isLoggedIn = true;
                
                // 保存到localStorage
                localStorage.setItem('github_username', username);
                localStorage.setItem('github_repo', repo);
                localStorage.setItem('github_token', token);
                
                return { success: true, user };
            } else {
                throw new Error('Token验证失败');
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    logout() {
        this.username = null;
        this.repo = null;
        this.token = null;
        this.isLoggedIn = false;
        
        localStorage.removeItem('github_username');
        localStorage.removeItem('github_repo');
        localStorage.removeItem('github_token');
    }
    
    loadCredentials() {
        const username = localStorage.getItem('github_username');
        const repo = localStorage.getItem('github_repo');
        const token = localStorage.getItem('github_token');
        
        if (username && repo && token) {
            this.username = username;
            this.repo = repo;
            this.token = token;
            this.isLoggedIn = true;
            return true;
        }
        return false;
    }
    
    async saveData(data) {
        if (!this.isLoggedIn) {
            throw new Error('请先登录');
        }
        
        const content = JSON.stringify(data, null, 2);
        const encodedContent = btoa(unescape(encodeURIComponent(content)));
        
        // 首先检查文件是否存在
        let sha = null;
        try {
            const getResponse = await fetch(
                `https://api.github.com/repos/${this.username}/${this.repo}/contents/${this.fileName}`,
                {
                    headers: {
                        'Authorization': `token ${this.token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );
            
            if (getResponse.ok) {
                const fileData = await getResponse.json();
                sha = fileData.sha;
            }
        } catch (error) {
            // 文件不存在，继续创建
        }
        
        // 创建或更新文件
        const body = {
            message: `Update mindmap - ${new Date().toLocaleString('zh-CN')}`,
            content: encodedContent
        };
        
        if (sha) {
            body.sha = sha;
        }
        
        const response = await fetch(
            `https://api.github.com/repos/${this.username}/${this.repo}/contents/${this.fileName}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github.v3+json'
                },
                body: JSON.stringify(body)
            }
        );
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || '保存失败');
        }
        
        return await response.json();
    }
    
    async loadData() {
        if (!this.isLoggedIn) {
            throw new Error('请先登录');
        }
        
        const response = await fetch(
            `https://api.github.com/repos/${this.username}/${this.repo}/contents/${this.fileName}`,
            {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );
        
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('云端没有找到数据文件');
            }
            throw new Error('加载失败');
        }
        
        const fileData = await response.json();
        const content = decodeURIComponent(escape(atob(fileData.content)));
        return JSON.parse(content);
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.mindMap = new MindMap();
    window.githubSync = new GitHubSync();
    
    // GitHub按钮事件
    const githubBtn = document.getElementById('githubBtn');
    const githubModal = document.getElementById('githubModal');
    const githubModalClose = document.getElementById('githubModalClose');
    const cancelGithubBtn = document.getElementById('cancelGithubBtn');
    
    
    if (githubBtn) {
        githubBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (githubModal) {
                githubModal.style.display = 'flex';
                
                // 检查是否已登录
                if (window.githubSync && window.githubSync.loadCredentials()) {
                    showGithubSyncSection();
                }
            }
        });
    }
    
    if (githubModalClose) {
        githubModalClose.addEventListener('click', () => {
            githubModal.style.display = 'none';
        });
    }
    
    if (cancelGithubBtn) {
        cancelGithubBtn.addEventListener('click', () => {
            githubModal.style.display = 'none';
        });
    }
    
    // GitHub登录
    const githubLoginBtn = document.getElementById('githubLoginBtn');
    if (githubLoginBtn) {
        githubLoginBtn.addEventListener('click', async () => {
        const username = document.getElementById('githubUsername').value.trim();
        const repo = document.getElementById('githubRepo').value.trim();
        const token = document.getElementById('githubToken').value.trim();
        
        if (!username || !repo || !token) {
            showGithubStatus('请填写完整信息', 'error');
            return;
        }
        
        showGithubStatus('正在登录...', 'info');
        githubLoginBtn.disabled = true;
        
        const result = await window.githubSync.login(username, repo, token);
        
        githubLoginBtn.disabled = false;
        
        if (result.success) {
            showGithubStatus('登录成功！', 'success');
            setTimeout(() => {
                showGithubSyncSection();
                document.getElementById('githubUserDisplay').textContent = `${username}/${repo}`;
            }, 500);
        } else {
            showGithubStatus(`登录失败：${result.error}`, 'error');
        }
        });
    }
    
    // 保存到云端
    const githubSaveBtn = document.getElementById('githubSaveBtn');
    if (githubSaveBtn) {
        githubSaveBtn.addEventListener('click', async () => {
        showGithubStatus('正在保存...', 'info');
        githubSaveBtn.disabled = true;
        
        try {
            const state = window.mindMap.serializeState();
            await window.githubSync.saveData(state);
            showGithubStatus('✅ 保存成功！', 'success');
        } catch (error) {
            showGithubStatus(`❌ 保存失败：${error.message}`, 'error');
        }
        
        githubSaveBtn.disabled = false;
        });
    }
    
    // 从云端加载
    const githubLoadBtn = document.getElementById('githubLoadBtn');
    if (githubLoadBtn) {
        githubLoadBtn.addEventListener('click', async () => {
        if (!confirm('加载云端数据会覆盖当前内容，是否继续？')) {
            return;
        }
        
        showGithubStatus('正在加载...', 'info');
        githubLoadBtn.disabled = true;
        
        try {
            const data = await window.githubSync.loadData();
            window.mindMap.restoreState(data);
            showGithubStatus('✅ 加载成功！', 'success');
        } catch (error) {
            showGithubStatus(`❌ 加载失败：${error.message}`, 'error');
        }
        
        githubLoadBtn.disabled = false;
        });
    }
    
    // 退出登录
    const githubLogoutBtn = document.getElementById('githubLogoutBtn');
    if (githubLogoutBtn) {
        githubLogoutBtn.addEventListener('click', () => {
        window.githubSync.logout();
        showGithubLoginSection();
        showGithubStatus('', '');
        });
    }
    
    function showGithubLoginSection() {
        document.getElementById('githubLoginSection').style.display = 'block';
        document.getElementById('githubSyncSection').style.display = 'none';
        document.getElementById('githubLoginButtons').style.display = 'flex';
        document.getElementById('githubSyncButtons').style.display = 'none';
    }
    
    function showGithubSyncSection() {
        document.getElementById('githubLoginSection').style.display = 'none';
        document.getElementById('githubSyncSection').style.display = 'block';
        document.getElementById('githubLoginButtons').style.display = 'none';
        document.getElementById('githubSyncButtons').style.display = 'flex';
        document.getElementById('githubUserDisplay').textContent = 
            `${window.githubSync.username}/${window.githubSync.repo}`;
    }
    
    function showGithubStatus(message, type) {
        const statusDiv = document.getElementById('githubStatus');
        statusDiv.textContent = message;
        statusDiv.className = 'status-message';
        if (type) {
            statusDiv.classList.add(type);
        }
        statusDiv.style.display = message ? 'block' : 'none';
    }
});

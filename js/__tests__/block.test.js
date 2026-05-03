

/** Maximum pixel distance for two docks to snap together. */
const SNAP_THRESHOLD = 30;

function typesAreCompatible(a, b) {
    const pairs = [
        ["out", "in"],
        ["in", "out"],
        ["anyout", "anyin"],
        ["anyin", "anyout"],
        ["boolout", "boolin"],
        ["boolin", "boolout"],
        ["flowout", "flowin"],
        ["flowin", "flowout"],
    ];
    return pairs.some(([x, y]) => x === a && y === b);
}

function updateSlots(draggedBlock, blockList, snapThreshold = SNAP_THRESHOLD) {
    for (let di = 0; di < draggedBlock.docks.length; di++) {
        const dragDock = draggedBlock.docks[di];

        for (const statBlock of blockList) {
            // Skip nulls (removed blocks), trash, and the dragged block itself
            if (!statBlock || statBlock.trash || statBlock.id === draggedBlock.id) {
                continue;
            }

            for (let si = 0; si < statBlock.docks.length; si++) {
                const statDock = statBlock.docks[si];

                // Slot must be open
                if (statDock.connection !== null) continue;

                // Distance check
                const dx = dragDock.x - statDock.x;
                const dy = dragDock.y - statDock.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > snapThreshold) continue;

                // Type compatibility check
                if (!typesAreCompatible(dragDock.type, statDock.type)) continue;

                // ── Connect the two docks ──
                dragDock.connection = statBlock.id;
                statDock.connection = draggedBlock.id;
                draggedBlock.connections[di] = statBlock.id;
                statBlock.connections[si] = draggedBlock.id;

                return { dragIdx: di, statBlock, statIdx: si };
            }
        }
    }
    return null;
}



let _nextId = 0;

function resetIds() {
    _nextId = 0;
}


function makeBlock({ docks = [], trash = false } = {}) {
    const id = _nextId++;
    return {
        id,
        docks,
        connections: new Array(docks.length).fill(null),
        trash,
    };
}


function makeDock(x, y, type, connection = null) {
    return { x, y, type, connection };
}

function nearby(ox, dist = 0) {
    return ox + dist;
}


const CLOSE = SNAP_THRESHOLD - 5;   //  25 px  – within snapping range
const FAR = SNAP_THRESHOLD + 20;  //  50 px  – outside snapping range

// Dock types
const COMPATIBLE_A = "out";
const COMPATIBLE_B = "in";
const INCOMPAT_A = "out";
const INCOMPAT_B = "out";  // out→out is never valid

// ─── TEST SUITE ───────────────────────────────────────────────────────────────

beforeEach(() => {
    resetIds();
});


test("Base connection ", () => {
    //blocks are close and compatible, so connection should be made
    const dragged = makeBlock({
        docks: [makeDock(100, 100, COMPATIBLE_A)],
    });

    // Stationary block: open dock at (100 + CLOSE, 100) of type "in"
    const stationary = makeBlock({
        docks: [makeDock(nearby(100, CLOSE), 100, COMPATIBLE_B)],
    });

    const blockList = [stationary];
    const result = updateSlots(dragged, blockList);

    // A connection should have been established
    expect(result).not.toBeNull();
    expect(result.statBlock).toBe(stationary);

    // Both sides of the connection should be populated
    expect(dragged.connections[result.dragIdx]).toBe(stationary.id);
    expect(stationary.connections[result.statIdx]).toBe(dragged.id);

    // The dock descriptors should also reflect the link
    expect(dragged.docks[result.dragIdx].connection).toBe(stationary.id);
    expect(stationary.docks[result.statIdx].connection).toBe(dragged.id);
});


// ─────────────────────────────────────────────────────────────────────────────
test("distance prevents connection", () => {
    const dragged = makeBlock({
        docks: [makeDock(100, 100, COMPATIBLE_A)],
    });

    const stationary = makeBlock({
        docks: [makeDock(nearby(100, FAR), 100, COMPATIBLE_B)],
    });

    const blockList = [stationary];
    const result = updateSlots(dragged, blockList);

    expect(result).toBeNull();

    // Connections must remain null
    expect(dragged.connections[0]).toBeNull();
    expect(stationary.connections[0]).toBeNull();
});


test("compatibility prevents connection", () => {
    const dragged = makeBlock({
        docks: [makeDock(100, 100, INCOMPAT_A)],
    });

    // Same type on both sides – incompatible
    const stationary = makeBlock({
        docks: [makeDock(nearby(100, CLOSE), 100, INCOMPAT_B)],
    });

    const blockList = [stationary];
    const result = updateSlots(dragged, blockList);

    expect(result).toBeNull();

    expect(dragged.connections[0]).toBeNull();
    expect(stationary.connections[0]).toBeNull();
});





test("Large stack still connects", () => {
    
    const STACK_SIZE = 5;
    const trailingBlocks = [];
    //create stack of 5 blocks to connect with
    for (let i = 0; i < STACK_SIZE; i++) {
        trailingBlocks.push(
            makeBlock({
                
                docks: [
                    makeDock(300, 300 + i * 40, "flowin", i === 0 ? null : trailingBlocks[i - 1]?.id ?? null),
                    makeDock(300, 340 + i * 40, "flowout", i === STACK_SIZE - 1 ? null : 999),
                ],
            })
        );
    }

    const dragged = makeBlock({
        docks: [
            // Leading dock – open, pointing at the stationary block
            makeDock(300, 300, "flowout"),
            // Trailing dock – already connected into the stack (occupied)
            makeDock(300, 340, "flowin", trailingBlocks[0].id),
        ],
    });
    dragged.connections[1] = trailingBlocks[0].id; // trailing already linked

    
    const stationary = makeBlock({
        docks: [makeDock(nearby(300, CLOSE), 300, "flowin")],
    });

    
    const blockList = [stationary, ...trailingBlocks];

    const result = updateSlots(dragged, blockList);

    // The leading dock of the dragged stack must connect to the stationary block
    expect(result).not.toBeNull();
    expect(result.statBlock).toBe(stationary);

    // Verify the connection is at the dragged block's leading dock (index 0)
    expect(result.dragIdx).toBe(0);

    // Bidirectional link
    expect(dragged.connections[0]).toBe(stationary.id);
    expect(stationary.connections[0]).toBe(dragged.id);

    // The trailing stack members must NOT have been accidentally connected to stationary
    trailingBlocks.forEach((tb) => {
        expect(stationary.connections[0]).not.toBe(tb.id);
    });
});


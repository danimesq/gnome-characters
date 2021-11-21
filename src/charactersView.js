/* exported CharactersView FontFilter RecentCharacterListView */
// -*- Mode: js; indent-tabs-mode: nil; c-basic-offset: 4; tab-width: 4 -*-
//
// Copyright (C) 2014-2015  Daiki Ueno <dueno@src.gnome.org>
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation; either version 2
// of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

const { Adw, Gc, Gdk, GLib, Gio, GObject, Gtk, Pango, Graphene, PangoCairo } = imports.gi;

const Main = imports.main;
const Util = imports.util;

const BASELINE_OFFSET = 0.85;
const CELLS_PER_ROW = 5;
const NUM_ROWS = 5;
const NUM_COLUMNS = 3;
const CELL_SIZE = 50;

function getCellSize(fontDescription) {
    if (fontDescription === null || fontDescription.get_size() === 0)
        return CELL_SIZE;
    return fontDescription.get_size() * 2 / Pango.SCALE;
}

const CharacterListRow = GObject.registerClass({
}, class CharacterListRow extends GObject.Object {
    _init(characters, fontDescription, overlayFontDescription) {
        super._init({});

        this._characters = characters;
        this._fontDescription = fontDescription;
        this._overlayFontDescription = overlayFontDescription;
        this._styleManager = Adw.StyleManager.get_default();
    }

    draw(cr, x, y, width, height, styleContext) {
        let layout = PangoCairo.create_layout(cr);
        layout.set_font_description(this._fontDescription);

        this._styleContext = styleContext;
        // Draw baseline.
        // FIXME: Pick the baseline color from CSS.
        let accentColor = this._styleContext.lookup_color('accent_color')[1];
        Gdk.cairo_set_source_rgba(cr, accentColor);
        cr.setLineWidth(0.5);
        cr.moveTo(x, y + BASELINE_OFFSET * height);
        cr.relLineTo(width, 0);
        cr.stroke();
        let fgColor = this._styleContext.get_color();
        Gdk.cairo_set_source_rgba(cr, fgColor);

        // Draw characters.  Do centering and attach to the baseline.
        let cellSize = getCellSize(this._fontDescription);
        for (let i in this._characters) {
            var cellRect = new Gdk.Rectangle({ x: x + cellSize * i,
                y,
                width: cellSize,
                height: cellSize });
            if (Gc.character_is_invisible(this._characters[i])) {
                this._drawBoundingBox(cr, cellRect, this._characters[i]);
                this._drawCharacterName(cr, cellRect, this._characters[i]);
            } else {
                layout.set_text(this._characters[i], -1);
                if (layout.get_unknown_glyphs_count() === 0) {
                    let layoutBaseline = layout.get_baseline();
                    let logicalRect = layout.get_extents()[0];
                    cr.moveTo(x + cellSize * i - logicalRect.x / Pango.SCALE +
                              (cellSize - logicalRect.width / Pango.SCALE) / 2,
                    y + BASELINE_OFFSET * height -
                              layoutBaseline / Pango.SCALE);
                    PangoCairo.show_layout(cr, layout);
                } else {
                    this._drawBoundingBox(cr, cellRect, this._characters[i]);
                    this._drawCharacterName(cr, cellRect, this._characters[i]);
                }
            }
        }
    }

    _computeBoundingBox(cr, cellRect, uc) {
        let layout = PangoCairo.create_layout(cr);
        layout.set_font_description(this._fontDescription);
        layout.set_text(uc, -1);

        let shapeRect;
        let layoutBaseline;
        if (layout.get_unknown_glyphs_count() === 0) {
            let inkRect = layout.get_extents()[1];
            layoutBaseline = layout.get_baseline();
            shapeRect = inkRect;
        } else {
            // If the character cannot be rendered with the current
            // font settings, show a rectangle calculated from the
            // base glyphs ('AA').
            if (this._baseGlyphRect === null) {
                layout.set_text('AA', -1);
                let baseInkRect = layout.get_extents()[1];
                this._baseGlyphLayoutBaseline = layout.get_baseline();
                this._baseGlyphRect = baseInkRect;
            }
            layoutBaseline = this._baseGlyphLayoutBaseline;
            shapeRect = new Pango.Rectangle({
                x: this._baseGlyphRect.x,
                y: this._baseGlyphRect.y,
                width: this._baseGlyphRect.width,
                height: this._baseGlyphRect.height,
            });
            let characterWidth = Gc.character_width(uc);
            if (characterWidth > 1)
                shapeRect.width *= characterWidth;
        }

        shapeRect.x = cellRect.x - shapeRect.x / Pango.SCALE +
            (cellRect.width - shapeRect.width / Pango.SCALE) / 2;
        shapeRect.y = cellRect.y + BASELINE_OFFSET * cellRect.height -
            layoutBaseline / Pango.SCALE;
        shapeRect.width /= Pango.SCALE;
        shapeRect.height /= Pango.SCALE;
        return shapeRect;
    }

    _drawBoundingBox(cr, cellRect, uc) {
        cr.save();
        cr.rectangle(cellRect.x, cellRect.y, cellRect.width, cellRect.height);
        cr.clip();

        let layout = PangoCairo.create_layout(cr);
        layout.set_font_description(this._fontDescription);
        layout.set_text(uc, -1);
        let shapeRect = this._computeBoundingBox(cr, cellRect, uc);

        let borderWidth = 1;
        cr.rectangle(shapeRect.x - borderWidth * 2,
            shapeRect.y - borderWidth * 2,
            shapeRect.width + borderWidth * 2,
            shapeRect.height + borderWidth * 2);
        cr.setSourceRGBA(239.0 / 255.0, 239.0 / 255.0, 239.0 / 255.0, 1.0);
        cr.fill();

        cr.restore();
    }

    _drawCharacterName(cr, cellRect, uc) {
        cr.save();
        cr.rectangle(cellRect.x, cellRect.y, cellRect.width, cellRect.height);
        cr.clip();

        let layout = PangoCairo.create_layout(cr);
        layout.set_width(cellRect.width * Pango.SCALE * 0.8);
        layout.set_height(cellRect.height * Pango.SCALE * 0.8);
        layout.set_wrap(Pango.WrapMode.WORD);
        layout.set_ellipsize(Pango.EllipsizeMode.END);
        layout.set_alignment(Pango.Alignment.CENTER);
        layout.set_font_description(this._overlayFontDescription);
        let name = Gc.character_name(uc);
        let text = name === null ? _('Unassigned') : Util.capitalize(name);
        layout.set_text(text, -1);
        let logicalRect = layout.get_extents()[0];
        cr.moveTo(cellRect.x - logicalRect.x / Pango.SCALE +
                  (cellRect.width - logicalRect.width / Pango.SCALE) / 2,
        cellRect.y - logicalRect.y / Pango.SCALE +
                  (cellRect.height - logicalRect.height / Pango.SCALE) / 2);
        let textColor;
        if (!this._styleManager.dark)
            textColor = this._styleContext.get_color(Gtk.StateFlags.NORMAL);
        else
            textColor = this._styleContext.get_background_color(Gtk.StateFlags.NORMAL);

        Gdk.cairo_set_source_rgba(cr, textColor);
        PangoCairo.show_layout(cr, layout);

        cr.restore();
    }
});

const CharacterListWidget = GObject.registerClass({
    Signals: {
        'character-selected': { param_types: [GObject.TYPE_STRING] },
    },
}, class CharacterListWidget extends Gtk.Widget {
    _init(numRows) {
        super._init({
            hexpand: true,
            vexpand: true,
        });
        this.add_css_class('character-list');
        this._cellsPerRow = CELLS_PER_ROW;
        this._numRows = numRows;
        this._characters = [];
        this._rows = [];
        /* this.add_events(Gdk.EventMask.BUTTON_PRESS_MASK |
                        Gdk.EventMask.BUTTON_RELEASE_MASK);
        this.drag_source_set(Gdk.ModifierType.BUTTON1_MASK,
                             null,
                             Gdk.DragAction.COPY);
        this.drag_source_add_text_targets();
        */
        this._character = null;
    }
    /*
    vfunc_drag_begin(context) {
        let cellSize = getCellSize(this._fontDescription);
        this._dragSurface = new Cairo.ImageSurface(Cairo.Format.ARGB32,
                                                   cellSize,
                                                   cellSize);
        let cr = new Cairo.Context(this._dragSurface);
        cr.setSourceRGBA(1.0, 1.0, 1.0, 1.0);
        cr.paint();
        cr.setSourceRGBA(0.0, 0.0, 0.0, 1.0);
        let row = this._createCharacterListRow([this._character]);
        row.draw(cr, 0, 0, cellSize, cellSize, this.get_style_context());
        Gtk.drag_set_icon_surface(context, this._dragSurface, 0, 0);
    }

    vfunc_drag_data_get(context, data, info, time) {
        if (this._character !== null)
            data.set_text(this._character, -1);
    }

    vfunc_button_press_event(event) {
        let allocation = this.get_allocation();
        let cellSize = getCellSize(this._fontDescription);
        let x = Math.floor(event.x / cellSize);
        let y = Math.floor(event.y / cellSize);
        let index = y * this._cellsPerRow + x;
        if (index < this._characters.length)
            this._character = this._characters[index];
        else
            this._character = null;
        return false;
    }

    vfunc_button_release_event(event) {
        if (this._character)
            this.emit('character-selected', this._character);
        return false;
    }
    */

    vfunc_measure(orientation, _forSize) {
        if (orientation === Gtk.Orientation.HORIZONTAL) {
            let cellSize = getCellSize(this._fontDescription);
            let minWidth = NUM_COLUMNS * cellSize;
            let natWidth = Math.max(this._cellsPerRow, NUM_COLUMNS) * cellSize;
            return [minWidth, natWidth, -1, -1];
        } else {
            let height = Math.max(this._rows.length, this._numRows) *
                getCellSize(this._fontDescription);
            return [height, height, -1, -1];
        }
    }

    vfunc_snapshot(snapshot) {
        // Clear the canvas.
        let allocation = this.get_allocation();
        let rect = new Graphene.Rect({
            origin: new Graphene.Point({ x: 0, y: 0 }),
            size: new Graphene.Size({ width: allocation.width, height: allocation.height }),
        });
        let cr = snapshot.append_cairo(rect);

        let context = this.get_style_context();
        let fg = context.get_color();
        Gdk.cairo_set_source_rgba(cr, fg);

        // Use device coordinates directly, since PangoCairo doesn't
        // work well with scaled matrix:
        // https://bugzilla.gnome.org/show_bug.cgi?id=700592

        // Redraw rows within the clipped region.
        let [_, y1, __, y2] = cr.clipExtents();
        let cellSize = getCellSize(this._fontDescription);
        let start = Math.max(0, Math.floor(y1 / cellSize));
        let end = Math.min(this._rows.length, Math.ceil(y2 / cellSize));
        for (let index = start; index < end; index++) {
            this._rows[index].draw(cr, 0, index * cellSize,
                allocation.width, cellSize, context);
        }
    }

    vfunc_get_request_mode() {
        return Gtk.SizeRequestMode.HEIGHT_FOR_WIDTH;
    }

    vfunc_size_allocate(width, height, baseline) {
        super.vfunc_size_allocate(width, height, baseline);

        let cellSize = getCellSize(this._fontDescription);
        let cellsPerRow = Math.floor(width / cellSize);
        if (cellsPerRow !== this._cellsPerRow) {
            // Reflow if the number of cells per row has changed.
            this._cellsPerRow = cellsPerRow;
            this.setCharacters(this._characters);
        }
    }

    _createCharacterListRow(characters) {
        var context = this.get_pango_context();
        var overlayFontDescription = context.get_font_description();
        overlayFontDescription.set_size(overlayFontDescription.get_size() * 0.8);

        let row = new CharacterListRow(characters, this._fontDescription, overlayFontDescription);
        return row;
    }

    setFontDescription(fontDescription) {
        this._fontDescription = fontDescription;
    }

    setCharacters(characters) {
        this._rows = [];
        this._characters = characters;

        let start = 0, stop = 1;
        for (; stop <= characters.length; stop++) {
            if (stop % this._cellsPerRow === 0) {
                let rowCharacters = characters.slice(start, stop);
                let row = this._createCharacterListRow(rowCharacters);
                this._rows.push(row);
                start = stop;
            }
        }
        if (start !== stop - 1) {
            let rowCharacters = characters.slice(start, stop);
            let row = this._createCharacterListRow(rowCharacters);
            this._rows.push(row);
        }

        this.queue_resize();
        this.queue_draw();
    }
});

const MAX_SEARCH_RESULTS = 100;

var FontFilter = GObject.registerClass({
    Properties: {
        'font': GObject.ParamSpec.string(
            'font', '', '',
            GObject.ParamFlags.READABLE | GObject.ParamFlags.WRITABLE,
            'Cantarell 50'),
    },
    Signals: {
        'filter-set': { param_types: [] },
    },
}, class FontFilter extends GObject.Object {
    _init() {
        super._init({});

        this._fontDescription = null;
        this._filterFontDescription = null;

        Main.settings.bind('font', this, 'font', Gio.SettingsBindFlags.DEFAULT);
    }

    get font() {
        return this._font;
    }

    set font(v) {
        let fontDescription = Pango.FontDescription.from_string(v);
        if (fontDescription.get_size() === 0)
            fontDescription.set_size(CELL_SIZE * Pango.SCALE);

        if (this._fontDescription &&
            fontDescription.equal(this._fontDescription))
            return;

        this._font = v;
        this._fontDescription = fontDescription;
    }

    get fontDescription() {
        if (this._filterFontDescription)
            return this._filterFontDescription;
        return this._fontDescription;
    }

    setFilterFont(v) {
        let fontDescription;
        if (v === null) {
            fontDescription = null;
        } else {
            fontDescription = Pango.FontDescription.from_string(v);
            fontDescription.set_size(this._fontDescription.get_size());
        }

        if (this._filterFontDescription !== null && fontDescription === null ||
            this._filterFontDescription === null && fontDescription !== null ||
            this._filterFontDescription !== null && fontDescription !== null &&
             !fontDescription.equal(this._filterFontDescription)) {
            this._filterFontDescription = fontDescription;
            this.emit('filter-set');
        }
    }

    filter(widget, characters) {
        let fontDescription = this._fontDescription;
        if (this._filterFontDescription) {
            let context = widget.get_pango_context();
            let filterFont = context.load_font(this._filterFontDescription);
            let filteredCharacters = [];
            for (let index = 0; index < characters.length; index++) {
                let uc = characters[index];
                if (Gc.pango_context_font_has_glyph(context, filterFont, uc))
                    filteredCharacters.push(uc);
            }
            characters = filteredCharacters;
            fontDescription = this._filterFontDescription;
        }

        return [fontDescription, characters];
    }
});

var CharactersView = GObject.registerClass({
    Template: 'resource:///org/gnome/Characters/characters_view.ui',
    Signals: {
        'character-selected': { param_types: [GObject.TYPE_STRING] },
    },
    Properties: {
        'model': GObject.ParamSpec.object(
            'model',
            'Characters List Model', 'Characters List Model',
            GObject.ParamFlags.READWRITE,
            Gio.ListModel.$gtype,
        ),
    },
}, class CharactersView extends Adw.Bin {
    _init() {
        super._init();

        this._characterList = new CharacterListWidget(NUM_ROWS);
        this._characterList.connect('character-selected', (w, c) => this.emit('character-selected', c));

        this.set_child(this._characterList);

        this._characters = [];
        this._spinnerTimeoutId = 0;
        this._searchContext = null;
        this._cancellable = new Gio.Cancellable();
        this._cancellable.connect(() => {
            this._stopSpinner();
            this._searchContext = null;
            this._characters = [];
            this._updateCharacterList();
        });
        /* TODO: use listmodels & grid view hopefully
        scroll.connect('edge-reached', (scrolled, pos) => this._onEdgeReached(scrolled, pos));
        scroll.connect('size-allocate', (scrolled, allocation) => this._onSizeAllocate(scrolled, allocation));
        */
    }

    setFontFilter(fontFilter) {
        this._characterList.setFontDescription(fontFilter.fontDescription);
        fontFilter.connect('filter-set', () => this._updateCharacterList());
        this._fontFilter = fontFilter;
    }

    _startSpinner() {
        this._stopSpinner();
        this._spinnerTimeoutId =
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
                // this._loading_spinner.start();
                // this.visible_child_name = 'loading';
            });
    }

    _stopSpinner() {
        if (this._spinnerTimeoutId > 0) {
            GLib.source_remove(this._spinnerTimeoutId);
            this._spinnerTimeoutId = 0;
            // this._loading_spinner.stop();
        }
    }

    _finishSearch(result) {
        this._stopSpinner();

        let characters = Util.searchResultToArray(result);

        this.setCharacters(characters);
    }

    setCharacters(characters) {
        this._characters = characters;
        this._updateCharacterList();
    }

    _updateCharacterList() {
        log('Updating characters list');
        const [fontDescription, characters] = this._fontFilter.filter(this, this._characters);
        log(JSON.stringify(characters));
        this._characterList.setFontDescription(fontDescription);
        this._characterList.setCharacters(characters);
    }

    get initialSearchCount() {
        // Use our parents allocation; we aren't visible before we do the
        // initial search, so our allocation is 1x1
        let allocation = this.get_parent().get_allocation();

        // Sometimes more MAX_SEARCH_RESULTS are visible on screen
        // (eg. fullscreen at 1080p).  We always present a over-full screen,
        // otherwise the lazy loading gets broken
        let cellSize = getCellSize(this._fontFilter.fontDescription);
        let cellsPerRow = Math.floor(allocation.width / cellSize);
        // Ensure the rows cause a scroll
        let heightInRows = Math.ceil((allocation.height + 1) / cellSize);

        return Math.max(MAX_SEARCH_RESULTS, heightInRows * cellsPerRow);
    }

    _addSearchResult(result) {
        const characters = Util.searchResultToArray(result);
        this.setCharacters(this._characters.concat(characters));
    }

    _searchWithContext(context, count) {
        this._startSpinner();
        context.search(count, this._cancellable, (ctx, res) => {
            this._stopSpinner();
            try {
                let result = ctx.search_finish(res);
                this._addSearchResult(result);
            } catch (e) {
                log(`Failed to search: ${e.message}`);
            }
        });
    }

    searchByCategory(category) {
        this._characters = [];
        /* if ('scripts' in category) {
            this.searchByScripts(category.scripts);
            return;
        }*/

        let criteria = Gc.SearchCriteria.new_category(category);
        this._searchContext = new Gc.SearchContext({ criteria });
        this._searchWithContext(this._searchContext, this.initialSearchCount);
    }

    searchByKeywords(keywords) {
        const criteria = Gc.SearchCriteria.new_keywords(keywords);
        this._searchContext = new Gc.SearchContext({
            criteria,
            flags: Gc.SearchFlag.WORD,
        });
        this._searchWithContext(this._searchContext, this.initialSearchCount);
    }

    searchByScripts(scripts) {
        var criteria = Gc.SearchCriteria.new_scripts(scripts);
        this._searchContext = new Gc.SearchContext({ criteria });
        this._searchWithContext(this._searchContext, this.initialSearchCount);
    }

    cancelSearch() {
        this._cancellable.cancel();
        this._cancellable.reset();
    }
});

var RecentCharacterListView = GObject.registerClass({
    Signals: {
        'character-selected': { param_types: [GObject.TYPE_STRING] },
    },
}, class RecentCharacterListView extends Adw.Bin {
    _init(category) {
        super._init({
            hexpand: true, vexpand: false,
        });

        this._characterList = new CharacterListWidget(0);
        this._characterList.connect('character-selected', (w, c) => this.emit('character-selected', c));
        this.set_child(this._characterList);

        this._category = category;
        this._characters = [];
    }

    setFontFilter(fontFilter) {
        this._characterList.setFontDescription(fontFilter.fontDescription);
        fontFilter.connect('filter-set', () => this._updateCharacterList());
        this._fontFilter = fontFilter;
    }

    setCharacters(characters) {
        const result = Gc.filter_characters(this._category, characters);
        this._characters = Util.searchResultToArray(result);
        this._updateCharacterList();
    }

    _updateCharacterList() {
        const [fontDescription, characters] = this._fontFilter.filter(this, this._characters);
        this._characterList.setFontDescription(fontDescription);
        this._characterList.setCharacters(characters);
    }
});

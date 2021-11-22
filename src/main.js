/* exported main settings */
// -*- Mode: js; indent-tabs-mode: nil; c-basic-offset: 4; tab-width: 4 -*-
//
// Copyright (c) 2013 Giovanni Campagna <scampa.giovanni@gmail.com>
//
// Redistribution and use in source and binary forms, with or without
//  modification, are permitted provided that the following conditions are met:
//   * Redistributions of source code must retain the above copyright
//     notice, this list of conditions and the following disclaimer.
//   * Redistributions in binary form must reproduce the above copyright
//     notice, this list of conditions and the following disclaimer in the
//     documentation and/or other materials provided with the distribution.
//   * Neither the name of the GNOME Foundation nor the
//     names of its contributors may be used to endorse or promote products
//     derived from this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
// ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
// WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE LIABLE FOR ANY
// DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
// (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
// LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
// ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
// SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

pkg.initGettext();
pkg.initFormat();
pkg.require({
    'Gdk': '4.0',
    'Gio': '2.0',
    'GLib': '2.0',
    'GObject': '2.0',
    'Gtk': '4.0',
    'Adw': '1',
    'GnomeDesktop': '4.0',
});

const { GLib, Gio, GObject, Adw } = imports.gi;

const { CharactersView } = imports.charactersView;
const { Sidebar } = imports.sidebar;
const { MenuPopover } = imports.menu;
const { MainWindow } = imports.window;

const Util = imports.util;

var settings = null;
var applicationId = pkg.name;

var MyApplication = GObject.registerClass({
}, class MyApplication extends Adw.Application {
    _init() {
        super._init({
            application_id: applicationId,
            flags: Gio.ApplicationFlags.FLAGS_NONE,
            resource_base_path: '/org/gnome/Characters',
        });
        GLib.set_application_name(_('Characters'));
    }

    _onQuit() {
        this.quit();
    }

    _onSearch(action, parameter) {
        const window = new MainWindow(this);
        window.setSearchKeywords(parameter.get_strv());
        window.show();
    }

    vfunc_startup() {
        super.vfunc_startup();

        this.get_style_manager().set_color_scheme(Adw.ColorScheme.PREFER_LIGHT);

        Util.initActions(this, [
            { name: 'quit', activate: this._onQuit },
            {
                name: 'search',
                activate: this._onSearch,
                parameterType: new GLib.VariantType('as'),
            },
        ]);
        this.set_accels_for_action('app.quit', ['<Primary>q']);
        this.set_accels_for_action('win.find', ['<Primary>f']);
        this.set_accels_for_action('win.show-primary-menu', ['F10']);
        this.set_accels_for_action('win.show-help-overlay', ['<Primary>question']);

        settings = Util.getSettings('org.gnome.Characters',
            '/org/gnome/Characters/');

        log('Characters Application started');
    }

    vfunc_activate() {
        if (!this._appwindow)
            this._appwindow = new MainWindow(this);


        this._appwindow.present();
        log('Characters Application activated');
    }

    vfunc_shutdown() {
        log('Characters Application exiting');

        super.vfunc_shutdown();
    }
});

function main(argv) {
    GObject.type_ensure(CharactersView.$gtype);
    GObject.type_ensure(Sidebar.$gtype);
    GObject.type_ensure(MenuPopover.$gtype);

    return new MyApplication().run(argv);
}

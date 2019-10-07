const API_URL = 'https://willbeddow.com/api/krlx/v1/live';
const { shell, remote } = require('electron');
const moment = require('./assets/moment.min.js');
const { init } = require('@sentry/electron');
let visitor = remote.getCurrentWindow().visitor;

visitor.screenview("Home Screen", "KRLX Desktop", remote.app.getVersion()).send();

init({
    dsn: 'https://79f7d930af9c4696a5229b962be84102@sentry.io/1446827',
    enableNative: false,
});
const UPDATE_URL = 'https://willbeddow.com/app/krlx-desktop';
let curr_songs = [];
let spotify_auth = null;
let auth_missed = 0;

/**
 * Take a host string in the form of Will Beddow '22 and return a widget with a picture of, and information
 * about, the host
 * @param host The host object, with name and image url
 */
function get_host_widget(host){
    let img_url = host.image;
    // Construct a widget
    return "<li class='list-group-item'>" +
        "<img class='img-thumbnail rounded-circle' width=50 size=50 src='"+img_url+"' alt='"+host.name+"'>" +
        "<b>"+host.name+"</b>"+
        "</li>"
}

function get_song_widget(song){
    let song_item = "<li href=\"#\" class=\"list-group-item\">";
    song_item += "<b>"+song.title+"</b> by "+song.artist;
    if (song.album && song.album !== ""){
        song_item += "<br><b>Album</b>: "+song.album;
    }
    song_item += "<br><b>Played By</b>: "+song.show_title;
    let yt_link = song.external.youtube.link;
    let spotify_link = song.external.spotify.link;
    let apple_link = null;
    let album_cover = song.external.spotify.album_cover;
    // Check if the spotify API is available
    song_item += "<br>Open in: ";
    if (apple_link){
        song_item += "<a href='#' onclick='shell.openExternal(\""+apple_link+"\")'><i class='fab fa-apple'></i></a>"
    }
    if (spotify_link){
        song_item += "<a href='#' onclick='shell.openExternal(\""+spotify_link+"\")'><i style='color: #1ED760' class='fab fa-spotify'></i></a>"
    }
    song_item += "<a href='#' onclick='shell.openExternal(\""+yt_link+"\")'><i style='color: #ff0000' class='fab fa-youtube'></i></a>";
    if (album_cover){
        song_item += '<img src="'+album_cover+'" width="50px" height="50px" style="border-radius: 5px; float: right"</img>'
    }
    song_item += "</li>";
    return song_item
}

function get_show_widget(show, hosts){
    let start_d = new Date();
    let end_d = new Date();
    if (!show.start){
        show.start = "17:00"
    }
    if (!show.end){
        show.end = "19:00"
    }
    if (!show.day){
        show.day = start_d.getDay();
    }
    if (!show.description){
        show.description = "No description found";
    }
    //[year, month, day, hour, minute, second, millisecond]
    let start_split = show.start.split(":");
    start_d.setHours(start_split[0], start_split[1]);
    let end_split = show.end.split(":");
    end_d.setHours(end_split[0], end_split[1]);
    let start = moment(start_d);
    let end = moment(end_d);
    let remaining = end.fromNow();
    if (remaining.includes("ago")){
        remaining = end.toNow();
    }
    let card = "<div class=\"card\">\n" +
        "  <div class=\"card-body\">\n" +
        "    <h4 class=\"card-title\">"+show.title+"</h4>\n" +
        "    <h6 class=\"card-subtitle mb-2 text-muted\">"+show.day+","+start.format("h:mm A")+"-"+end.format("h:mm A")+"</h6>\n" +
        "    <p class=\"card-text\">"+show.description+
        "</p>\n"+
        " <ul class='list-group'>";
     for (host of hosts){
         card += host;
     }
     card +=
        " </ul><br><p>Ends "+remaining+"</p></div>\n" +
        "</div>";
    return card
}

function get_upcoming_widget(show){
    console.log("Getting upcoming widget for ");
    console.log(show);
    let start_d = new Date();
    let end_d = new Date();
    //[year, month, day, hour, minute, second, millisecond]
    // Fix bandemonium start end
    if (!show.start){
        show.start = "17:00"
    }
    if (!show.end){
        show.end = "19:00"
    }
    if (!show.day){
        show.day = start_d.getDay();
    }
    if (!show.description){
        show.description = "No description found";
    }
    let start_split = show.start.split(":");
    start_d.setHours(start_split[0], start_split[1]);
    let end_split = show.end.split(":");
    end_d.setHours(end_split[0], end_split[1]);
    let start = moment(start_d);
    let end = moment(end_d);
    let until = start.fromNow();
    if (until.includes("ago")){
        until = start.toNow();
    }
    let widget = "<div class='card mb-3'>";
    let dj_widgets = [];
    for (let dj of show.djs){
        dj_widgets.push("<img class='img-thumbnail rounded-circle' width=40 size=40 src='"
            +dj.image+"' alt='"+dj.name+"'><span>"+dj.name+"</span>")
    }
    widget += "<div><div class='card-header'>" +
    "      <h5 class=\"card-title\">"+show.title+"</h5>\n" +
    "      <h6 class='card-subtitle'>"+show.day+","+start.format("h:mm A")+"-"+end.format("h:mm A")+"</h6>\n"+
        "</div>"+
    "    </div><div class='card-body'>\n" +
    "    <p class=\"mb-1\">"+show.description+"</p>\n" +
        "<p class='mb-1'>"+dj_widgets.join(',')+"</p>"+
        "</div><div class='card-footer'><p class='mb-1'>Starts "+until+"</p></div>"+
    "  </a></div></div>";
    return widget
}

function set_songs(page){
    let song_cont = "<div class='list-group'>";
    let active_page = parseInt($(".song-page.page-item.active").text());
    // Next
    if (page===0){
        page = active_page+1;
    }
    // Last
    else if (page===-1){
        page = active_page-1;
    }
    let end_slice = page*5;
    let start_slice = end_slice-5;
    for (song of curr_songs.slice(start_slice,end_slice)){
        song_cont += get_song_widget(song);
    }
    song_cont += "</div>";
    $("#songs")[0].innerHTML = song_cont;
    $(".song-page.page-item.active").removeClass("active");
    $('.song-page.page-item:contains('+page+')').addClass("active");
    if (page===1){
        $('#last-song').addClass("disabled")
    }
    else{
        $('#last-song').removeClass("disabled")
    }
    if(page===4){
        $("#next-song").addClass("disabled")
    }
    else{
        $("#next-song").removeClass("disabled")
    }
}


function handle_data(query_data){
    console.log(query_data);
    if (query_data.status.online){
        $("#currstatus")[0].innerHTML = "<span class=\"badge badge-pill badge-success\">On Air</span>";
        let dj_widgets = [];
        for (dj of query_data.data.now.djs){
            let widget = get_host_widget(dj);
            dj_widgets.push(widget);
        }
        let show_widget = get_show_widget(query_data.data.now, dj_widgets);
        $("#currshow")[0].innerHTML = show_widget;

        curr_songs = query_data.data.songs;
        set_songs(1);
        let next_widget = "<div>";
        for (show of query_data.data.next){
            show_widget = get_upcoming_widget(show);
            next_widget += show_widget;
        }
        next_widget += '</div>';
        $("#upcoming")[0].innerHTML = next_widget;
    }
    else{
        $("#currstatus")[0].innerHTML = "<span class='badge badge-pill badge-danger'>"+query_data.status.blurb+"</span>";
    }
}

/**
 * Query the stream information from API_URL
 */
function query_stream(){
    $.getJSON({
        url: API_URL,
        success: function (data) {
            console.log("Got KRLX data");
            handle_data(data)
        },
        error: function(jqXHR, textStatus, errorThrown){
            console.log("Query errror "+jqXHR+" "+textStatus+" "+errorThrown);
        }
    });
}

/**
 * Poll my website (willbeddow.com/app/krlx-desktop), for a JSON feed of status messages and app app update aviailability
 * Please note: This is the **only** place this app communicates in the background with my servers.
 */
function check_updates(){
    $.getJSON({
        url: UPDATE_URL,
        success: function(data){
            console.log("Got update data");
            console.log(data);
            let curr_version = remote.app.getVersion();
            let remote_version = data.updates.version;
            let update_url = data.updates.update;
            let status_message = data.status;
            // Update available
            if (curr_version === remote_version){
                $("#updates-title")[0].style.display = 'none';
                $("#updates")[0].innerHTML = "You're all up to date! Version "+curr_version+". <a href='#' onclick='check_updates()'>Check again</a>";
            }
            else{
                $("#updates-title")[0].style.display = 'block';
                $("#message-card").addClass("bg-warning");
                $("#messages-title").innerHTML = "Update Available!";
                $("#updates")[0].innerHTML = "<strong>Update available, <a href='#' onclick='shell.openExternal(\""+update_url+"\")'>get it here!</a>"
            }
            if (status_message){
                $("#message-inner-title")[0].style.display = "block";
                $("#message-card").removeClass("border-primary").addClass("border-info");
                $("#messages")[0].innerHTML = status_message;
            }
            else{
                $("#message-inner-title")[0].style.display = 'none';
            }
        },
        error: function(jqXHR, textStatus, errorThrown){
            console.log("Update check errror "+jqXHR+" "+textStatus+" "+errorThrown);
        }
    })
}


$(document).ready(function(){
    console.log("Starting interval");
    query_stream();
    // The handler for checking the KRLX API every 30 seconds
    setInterval(query_stream, 30000);
    //query_stream();
    check_updates();
});


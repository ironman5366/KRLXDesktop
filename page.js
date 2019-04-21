const API_URL = 'http://live.krlx.org/data.php';
const SPOTIFY_API_URL = 'https://api.spotify.com/v1/search';
const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/api/token';
const { shell } = require('electron');
const Base64 = require('./node_modules/js-base64').Base64;
const fs = require('fs');
const moment = require('./assets/moment.min.js');
const spotify_api = require('./spotify_api.json');
// The RegEx to resolve student images from the directory
const DIR_REG = new RegExp('(<div class="email"><span class="icon">' +
    '\\n{0,1}<\\/span>(\\w+)&nbsp;)|<span class="icon"><\\/span><a href="mailto:(\\w+)@carleton.edu">');
const HOST_REG = new RegExp('(\\S+) (\\S+) \'(\\d\\d)');
let curr_songs = [];
let spotify_auth = null;
let song_queries = {
    "spotify": {},
    "apple": {}
};

/**
 * Take a host string in the form of Will Beddow '22 and return a widget with a picture of, and information
 * about, the host
 * @param host_str
 */
function get_host_widget(host_str){
    let parsed_host_str = HOST_REG.exec(host_str);
    console.log("Parsed");
    let first_name = parsed_host_str[1];
    let last_name = parsed_host_str[2];
    let class_year = "20"+parsed_host_str[3];
    let username= null;
    let data = $.get({
        url: 'https://apps.carleton.edu/campus/directory/?first_name='+first_name+'&last_name='+last_name+'' +
            '&search_for=student',
        success: function(data){
            let parsed_page = DIR_REG.exec(data);
            username = parsed_page[1];
            if (!username){
                username = parsed_page[3];
            }
        },
        async: false
    });
    let img_url = 'https://apps.carleton.edu/stock/ldapimage.php?id='+username+'&source=campus_directory';
    // Construct a widget
    return "<li class='list-group-item'>" +
        "<img class='img-thumbnail rounded-circle' width=50 size=50 src='"+img_url+"' alt='"+host_str+"'>" +
        "<b>"+host_str+"</b>"+
        "</li>"
}

function get_song_widget(song){
    let song_item = "<li href=\"#\" class=\"list-group-item\">";
    song_item += "<b>"+song.title+"</b> by "+song.artist;
    if (song.album && song.album !== ""){
        song_item += "<br><b>Album</b>: "+song.album;
    }
    song_item += "<br><b>Played By</b>: "+song.show_title;
    let yt_link = 'https://www.youtube.com/results?search_query='+song.title+"+"+song.artist;
    let spotify_link = null;
    let apple_link = null;
    // Check if the spotify API is available
    if (spotify_auth){
        // Build the query string
        let query_string = song.title +" artist:\""+song.artist+"\"";
        if (song.album && song.album !== "") {
            query_string+= " album:\""+song.album+"\""
        }
        if (song_queries.spotify.hasOwnProperty(query_string)){
            console.log("Got cached spotify data");
            let data = song_queries.spotify[query_string];
            if (data.tracks.items.length >= 1){
                try {
                    spotify_link = data.tracks.items[0].external_urls.spotify;
                }
                catch (err){
                    console.log("Couldn't get external url of:");
                    console.log(data);
                }
            }
        }
        else {
            $.getJSON({
                url: SPOTIFY_API_URL,
                headers: {
                    'Authorization': "Bearer " + spotify_auth
                },
                data: {
                    q: query_string,
                    limit: 1,
                    market: "US",
                    type: "track"
                },
                async: false,
                success: function (data) {
                    console.log("Got spotify search data");
                    song_queries.spotify[query_string] = data;
                    try {
                        if (data.tracks.items.length >= 1){
                            spotify_link = data.tracks.items[0].external_urls.spotify;
                        }
                    }
                    catch (err){
                        console.log("Couldn't get external url of:");
                    }
                },
                error: function (jqXHR, textStatus, errorThrown) {
                    console.log("Spotify search errror " + jqXHR + " " + textStatus + " " + errorThrown);
                    console.log(jqXHR);
                    console.log(textStatus);
                    throw errorThrown;
                }
            });
        }
    }
    else{
        console.warn("No spotify auth :(");
    }
    song_item += "<br>Open in: ";
    if (apple_link){
        song_item += "<a href='#' onclick='shell.openExternal(\""+apple_link+"\")'><i class='fab fa-apple'></i></a>"
    }
    if (spotify_link){
        song_item += "<a href='#' onclick='shell.openExternal(\""+spotify_link+"\")'><i style='color: #1ED760' class='fab fa-spotify'></i></a>"
    }
    song_item += "<a href='#' onclick='shell.openExternal(\""+yt_link+"\")'><i style='color: #ff0000' class='fab fa-youtube'></i></a>";
    song_item += "</li>";
    return song_item
}

function get_show_widget(show, hosts){
    let start_d = new Date();
    let end_d = new Date();
    //[year, month, day, hour, minute, second, millisecond]
    let start_split = show.start.split(":");
    start_d.setHours(start_split[0], start_split[1]);
    let end_split = show.end.split(":");
    end_d.setHours(end_split[0], end_split[1]);
    let start = moment(start_d);
    let end = moment(end_d);
    let remaining = end.fromNow();
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
    let start_d = new Date();
    let end_d = new Date();
    //[year, month, day, hour, minute, second, millisecond]
    let start_split = show.start.split(":");
    start_d.setHours(start_split[0], start_split[1]);
    let end_split = show.end.split(":");
    end_d.setHours(end_split[0], end_split[1]);
    let start = moment(start_d);
    let end = moment(end_d);
    let until = start.fromNow();
    let widget = "<div class='card mb-3'>";
    widget += "<div><div class='card-header'>" +
    "      <h5 class=\"card-title\">"+show.title+"</h5>\n" +
    "      <h6 class='card-subtitle'>"+show.day+","+start.format("h:mm A")+"-"+end.format("h:mm A")+"</h6>\n"+
        "</div>"+
    "    </div><div class='card-body'>\n" +
    "    <p class=\"mb-1\">"+show.description+"</p>\n" +
        "<p class='mb-1'>"+show.djs.join(',')+"</p>"+
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


function handle_data(data){
    console.log(data);
    if (data.status === "on_air"){
        $("#currstatus")[0].innerHTML = "<span class=\"badge badge-pill badge-success\">On Air</span>";
        let dj_widgets = [];
        for (dj of data.now.djs){
            let widget = get_host_widget(dj);
            dj_widgets.push(widget);
        }
        let show_widget = get_show_widget(data.now, dj_widgets);
        $("#currshow")[0].innerHTML = show_widget;

        curr_songs = data.songs;
        set_songs(1);
        let next_widget = "<div>";
        for (show of data.next){
            show_widget = get_upcoming_widget(show);
            next_widget += show_widget;
        }
        next_widget += '</div>';
        $("#upcoming")[0].innerHTML = next_widget;
    }
    else{
        $("#currstatus")[0].innerHTML = "<span class='badge badge-pill badge-danger'>"+data.status+"</span>";
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
            console.log("Query errror "+jqXHR+" "+textStatus+" "+errorThrown+" trying to fix...");
            $.get({
                url: API_URL,
                success: function (data){
                    let parsed_data = JSON.parse(data);
                    console.log("Fixed stream data");
                    handle_data(parsed_data);
                }
            })
        }
    });
}

/**
 * Log in with Spotify
 */
function spotify_basic_auth(auth_data){
    console.log("Doing spotify auth");
    let client_id = auth_data.client_id;
    let client_secret = auth_data.client_secret;
    let auth_str = "Basic "+Base64.encode(client_id+":"+client_secret);
    $.post({
        url: SPOTIFY_AUTH_URL,
        headers: {
            'Authorization': auth_str
        },
        data: {
            grant_type: 'client_credentials'
        },
        success: function(data){
            spotify_auth = data.access_token;
            console.log("Spotify auth successful. Doing again in "+data.expires_in+" seconds")
            // Set the token to auto refresh whenever necessary
            setInterval(function(){
                spotify_basic_auth(data);
            }, data.expires_in*1000)
        },
        error: function(jqXHR, textStatus, errorThrown){
            console.log("Spotify auth errror "+jqXHR+" "+textStatus+" "+errorThrown);
            throw errorThrown;
        }
    })
}

$(document).ready(function(){
    spotify_basic_auth(spotify_api);
    console.log("Starting interval");
    query_stream();
    // The handler for checking the KRLX API every 5 seconds
    setInterval(query_stream, 30000);
    //query_stream();

});


const API_URL = 'http://live.krlx.org/data.php';
const { shell } = require('electron');
// The RegEx to resolve student images from the directory
const DIR_REG = new RegExp('(<div class="email"><span class="icon">' +
    '\\n{0,1}<\\/span>(\\w+)&nbsp;)|<span class="icon"><\\/span><a href="mailto:(\\w+)@carleton.edu">');
const HOST_REG = new RegExp('(\\w+) (\\w+) \'(\\d\\d)');
let curr_songs = [];

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
    song_item += "<br>" +
        "<i style='color: #1ED760' class='fab fa-spotify'></i>" +
        "<i class='fab fa-apple'></i>" +
        "<a href='#' onclick='shell.openExternal(\""+yt_link+"\")'><i style='color: #ff0000' class='fab fa-youtube'></i></a>";
    song_item += "</li>";
    return song_item
}

function get_show_widget(show, hosts){
    let card = "<div class=\"card\">\n" +
        "  <div class=\"card-body\">\n" +
        "    <h4 class=\"card-title\">"+show.title+"</h4>\n" +
        "    <h6 class=\"card-subtitle mb-2 text-muted\">"+show.day+","+show.start+"-"+show.end+"</h6>\n" +
        "    <p class=\"card-text\">"+show.description+"</p>\n"+
        " <ul class='list-group'>";
     for (host of hosts){
         card += host;
     }
     card +=
        " </ul></div>\n" +
        "</div>";
    return card
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



/**
 * Query the stream information from API_URL
 */
function query_stream(){
    $.getJSON({
        url: API_URL,
        success: function (data) {
            console.log("Got KRLX data");
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
                //$("#currsong")[0].innerHTML = get_song_widget(data.songs[0])
            }
            else{
                $("#currstatus")[0].innerHTML = "<span class='badge badge-pill badge-danger'>"+data.status+"</span>";
            }
        }
    });
}

$(document).ready(function(){
    console.log("Starting interval");
    query_stream();
    // The handler for checking the KRLX API every 5 seconds
    setInterval(query_stream, 30000);
    //query_stream();

});

